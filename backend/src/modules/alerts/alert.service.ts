import { Brackets, IsNull, LessThan } from 'typeorm';
import dayjs from 'dayjs';

import { AppDataSource } from '../../database/data-source';
import { HttpError } from '../../common/errors/HttpError';
import { logger } from '../../config/logger';

import { Alert, AlertSeverity, AlertType } from './alert.entity';
import { Invoice, InvoiceStatus } from '../invoices/invoice.entity';
import { NotificationSettings } from '../notifications/notification-settings.entity';
import { VatReturn } from '../tax/vat-return.entity';
import { Form41Return } from '../tax/form41-return.entity';
import {
  TaxFilingStatus,
  vatDeadline,
  quarterEndDate,
  type Quarter,
} from '../tax/tax.utils';

const repo = () => AppDataSource.getRepository(Alert);

export const alertService = {
  async list(companyId: string, q: { onlyUnread?: boolean; limit?: number } = {}) {
    const qb = repo()
      .createQueryBuilder('a')
      .where('a.companyId = :companyId', { companyId })
      .andWhere('a.dismissedAt IS NULL');
    if (q.onlyUnread) qb.andWhere('a.readAt IS NULL');
    qb.orderBy('a.createdAt', 'DESC').take(Math.min(200, q.limit ?? 50));
    return qb.getMany();
  },

  async unreadCount(companyId: string) {
    return repo().count({
      where: { companyId, readAt: IsNull(), dismissedAt: IsNull() },
    });
  },

  async markRead(companyId: string, id: string) {
    const a = await repo().findOne({ where: { id, companyId } });
    if (!a) throw HttpError.notFound('Alert not found');
    a.readAt = a.readAt ?? new Date();
    return repo().save(a);
  },

  async markAllRead(companyId: string) {
    await repo()
      .createQueryBuilder()
      .update(Alert)
      .set({ readAt: () => 'CURRENT_TIMESTAMP' })
      .where('companyId = :companyId AND readAt IS NULL', { companyId })
      .execute();
    return { ok: true };
  },

  async dismiss(companyId: string, id: string) {
    const a = await repo().findOne({ where: { id, companyId } });
    if (!a) throw HttpError.notFound('Alert not found');
    a.dismissedAt = new Date();
    return repo().save(a);
  },

  /**
   * Upsert keyed on (companyId, dedupeKey). Calling this twice with the same
   * key updates the existing row instead of creating duplicates — the rule
   * engine relies on this to be idempotent across daily ticks.
   */
  async upsert(input: {
    companyId: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message?: string;
    payload?: Record<string, unknown>;
    invoiceId?: string;
    dedupeKey: string;
  }) {
    const existing = await repo().findOne({
      where: { companyId: input.companyId, dedupeKey: input.dedupeKey },
    });
    if (existing) {
      existing.title = input.title;
      existing.message = input.message;
      existing.payload = input.payload ?? existing.payload ?? null;
      existing.severity = input.severity;
      existing.invoiceId = input.invoiceId ?? existing.invoiceId ?? null;
      // Don't reset readAt — once acknowledged, stay acknowledged.
      return repo().save(existing);
    }
    return repo().save(
      repo().create({
        ...input,
        message: input.message ?? null,
        payload: input.payload ?? null,
        invoiceId: input.invoiceId ?? null,
      }),
    );
  },

  /**
   * Evaluate every rule against the current state of the tenant. Returns the
   * list of alerts touched in this tick (created or updated) for observability.
   */
  async evaluateForCompany(companyId: string) {
    const settings = await AppDataSource.getRepository(NotificationSettings).findOne({
      where: { companyId },
    });
    const cfg = settings ?? ({} as NotificationSettings);

    const touched: Alert[] = [];
    const invRepo = AppDataSource.getRepository(Invoice);
    const today = dayjs().format('YYYY-MM-DD');

    // ── Rule 1: Overdue invoices ───────────────────────────────────────
    if (cfg.alertOverdue ?? true) {
      const overdue = await invRepo
        .createQueryBuilder('i')
        .leftJoinAndSelect('i.customer', 'customer')
        .where('i.companyId = :companyId', { companyId })
        .andWhere(
          new Brackets((b) => {
            b.where('i.status = :acc', { acc: InvoiceStatus.ACCEPTED })
              .orWhere('i.status = :sub', { sub: InvoiceStatus.SUBMITTED })
              .orWhere('i.status = :ovd', { ovd: InvoiceStatus.OVERDUE });
          }),
        )
        .andWhere('i.amountPaid < i.total')
        .andWhere('i.dueDate IS NOT NULL')
        .andWhere('i.dueDate < :today', { today })
        .getMany();

      for (const inv of overdue) {
        // Flip the invoice status if it just crossed the line.
        if (inv.status !== InvoiceStatus.OVERDUE) {
          inv.status = InvoiceStatus.OVERDUE;
          await invRepo.save(inv);
        }
        const customer = (inv as any).customer?.name ?? '';
        const a = await this.upsert({
          companyId,
          type: AlertType.INVOICE_OVERDUE,
          severity: AlertSeverity.WARNING,
          title: `فاتورة متأخرة: ${inv.invoiceNumber}`,
          message: customer
            ? `الفاتورة ${inv.invoiceNumber} للعميل ${customer} تجاوزت تاريخ الاستحقاق.`
            : `الفاتورة ${inv.invoiceNumber} تجاوزت تاريخ الاستحقاق.`,
          payload: { invoiceNumber: inv.invoiceNumber, total: Number(inv.total) },
          invoiceId: inv.id,
          dedupeKey: `invoice_overdue:${inv.id}`,
        });
        touched.push(a);
      }
    }

    // ── Rule 2: ETA-rejected invoices ──────────────────────────────────
    if (cfg.alertRejected ?? true) {
      const rejected = await invRepo.find({
        where: { companyId, status: InvoiceStatus.REJECTED },
        order: { updatedAt: 'DESC' },
        take: 100,
      });
      for (const inv of rejected) {
        const a = await this.upsert({
          companyId,
          type: AlertType.INVOICE_REJECTED,
          severity: AlertSeverity.CRITICAL,
          title: `رفض من ETA: ${inv.invoiceNumber}`,
          message: inv.etaErrors ?? 'تم رفض الفاتورة من مصلحة الضرائب.',
          payload: { invoiceNumber: inv.invoiceNumber },
          invoiceId: inv.id,
          dedupeKey: `invoice_rejected:${inv.id}`,
        });
        touched.push(a);
      }
    }

    // ── Rule 3: Submission stuck (submitted > 1h, no UUID) ─────────────
    if (cfg.alertSubmissionStuck ?? true) {
      const oneHourAgo = dayjs().subtract(1, 'hour').toDate();
      const stuck = await invRepo
        .createQueryBuilder('i')
        .where('i.companyId = :companyId', { companyId })
        .andWhere('i.status = :sub', { sub: InvoiceStatus.SUBMITTED })
        .andWhere('i.etaUuid IS NULL')
        .andWhere('i.updatedAt < :cutoff', { cutoff: oneHourAgo })
        .getMany();
      for (const inv of stuck) {
        const a = await this.upsert({
          companyId,
          type: AlertType.SUBMISSION_STUCK,
          severity: AlertSeverity.WARNING,
          title: `إرسال متعثر إلى ETA: ${inv.invoiceNumber}`,
          message: 'لم تتلقَّ المصلحة استجابة لهذه الفاتورة منذ أكثر من ساعة.',
          payload: { invoiceNumber: inv.invoiceNumber },
          invoiceId: inv.id,
          dedupeKey: `submission_stuck:${inv.id}`,
        });
        touched.push(a);
      }
    }

    // ── Rule 4: Unusually-large invoices ───────────────────────────────
    if (cfg.alertLargeInvoice ?? true) {
      const threshold = Number(cfg.alertLargeInvoiceThreshold ?? 100000);
      if (threshold > 0) {
        const recent = await invRepo
          .createQueryBuilder('i')
          .where('i.companyId = :companyId', { companyId })
          .andWhere('i.total >= :threshold', { threshold })
          .andWhere('i.createdAt >= :since', {
            since: dayjs().subtract(2, 'day').toDate(),
          })
          .getMany();
        for (const inv of recent) {
          const a = await this.upsert({
            companyId,
            type: AlertType.LARGE_INVOICE,
            severity: AlertSeverity.INFO,
            title: `فاتورة كبيرة: ${inv.invoiceNumber}`,
            message: `قيمة ${Number(inv.total).toFixed(2)} ${inv.currency} تتجاوز الحد المحدد.`,
            payload: { invoiceNumber: inv.invoiceNumber, total: Number(inv.total) },
            invoiceId: inv.id,
            dedupeKey: `large_invoice:${inv.id}`,
          });
          touched.push(a);
        }
      }
    }

    // ── Rule 5: VAT due soon (5 days before deadline) ──────────────────
    {
      const checkMonth = dayjs().subtract(1, 'month');
      const year = checkMonth.year();
      const month = checkMonth.month() + 1;
      const deadline = vatDeadline(year, month);
      const daysLeft = deadline.diff(dayjs().startOf('day'), 'day');
      const vatRow = await AppDataSource.getRepository(VatReturn).findOne({
        where: { companyId, year, month },
      });
      const filed = vatRow?.status === TaxFilingStatus.FILED;
      if (!filed && daysLeft >= 0 && daysLeft <= 5) {
        const a = await this.upsert({
          companyId,
          type: AlertType.VAT_DUE_SOON,
          severity: daysLeft <= 2 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          title: `اقتراب موعد إقرار ض.ق.م — ${month}/${year}`,
          message: `الموعد النهائي ${deadline.format('YYYY-MM-DD')} (باقي ${daysLeft} يوم).`,
          payload: { href: `/vat-return?year=${year}&month=${month}`, year, month },
          dedupeKey: `vat_due_soon:${year}-${month}`,
        });
        touched.push(a);
      }
    }

    // ── Rule 6: Form 41 due soon (7 days before quarter end) ─────────────
    {
      const now = dayjs();
      const year = now.year();
      const qIndex = Math.floor(now.month() / 3);
      const quarter = (`Q${qIndex + 1}` as Quarter);
      const qEnd = quarterEndDate(year, quarter);
      const daysLeft = qEnd.diff(now.startOf('day'), 'day');
      const formRow = await AppDataSource.getRepository(Form41Return).findOne({
        where: { companyId, year, quarter },
      });
      const filed = formRow?.status === TaxFilingStatus.FILED;
      if (!filed && daysLeft >= 0 && daysLeft <= 7) {
        const a = await this.upsert({
          companyId,
          type: AlertType.FORM41_DUE_SOON,
          severity: daysLeft <= 3 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          title: `اقتراب موعد نموذج 41 — ${quarter} ${year}`,
          message: `ينتهي الربع ${qEnd.format('YYYY-MM-DD')} (باقي ${daysLeft} يوم).`,
          payload: { href: `/form41?year=${year}&quarter=${quarter}`, year, quarter },
          dedupeKey: `form41_due_soon:${year}-${quarter}`,
        });
        touched.push(a);
      }
    }

    logger.info({ companyId, touched: touched.length }, 'Alert rules evaluated');
    return touched;
  },

  /**
   * Cron entry point. Fans out across every company that has at least one
   * invoice — keeps the query bounded for empty/inactive tenants.
   */
  async evaluateAll() {
    const { Company } = await import('../companies/company.entity');
    const rows = await AppDataSource.getRepository(Company)
      .createQueryBuilder('c')
      .select('c.id', 'companyId')
      .getRawMany<{ companyId: string }>();

    const results: Array<{ companyId: string; touched: number }> = [];
    for (const { companyId } of rows) {
      try {
        const touched = await this.evaluateForCompany(companyId);
        results.push({ companyId, touched: touched.length });
      } catch (err) {
        logger.error({ err, companyId }, 'Alert rules failed for company');
      }
    }
    return results;
  },

  /** Cleanup helper — call from cron to garbage-collect ancient read alerts. */
  async pruneOld(beforeDays = 60) {
    const cutoff = dayjs().subtract(beforeDays, 'day').toDate();
    await repo().delete({
      readAt: LessThan(cutoff),
    });
  },
};
