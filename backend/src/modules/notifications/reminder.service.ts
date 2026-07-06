import { Brackets } from 'typeorm';
import dayjs from 'dayjs';

import { AppDataSource } from '../../database/data-source';
import { Invoice, InvoiceStatus } from '../invoices/invoice.entity';
import { NotificationSettings } from './notification-settings.entity';
import {
  WhatsappMessage,
  WhatsappStatus,
  WhatsappTemplate,
} from './whatsapp-message.entity';
import { notificationService } from './notification.service';
import { logger } from '../../config/logger';

/**
 * Scans every invoice across every tenant once a day and queues the
 * appropriate WhatsApp reminder:
 *   • `payment_reminder` — invoice is due in T-N days where N = `reminderLeadDays`
 *   • `overdue`          — invoice passed its due date and remains unpaid
 *
 * Deduplication: we never send the same template twice for the same invoice
 * on the same day (looked up via the `whatsapp_messages` audit table).
 */
export const reminderService = {
  async runForCompany(companyId: string) {
    const settings = await AppDataSource.getRepository(NotificationSettings).findOne({
      where: { companyId },
    });
    if (!settings || !settings.whatsappEnabled || !settings.sendReminders) {
      return { queued: 0, skipped: 'disabled' as const };
    }

    const leadDays = Math.max(0, Math.min(30, settings.reminderLeadDays ?? 3));
    const today = dayjs().format('YYYY-MM-DD');
    const targetDate = dayjs().add(leadDays, 'day').format('YYYY-MM-DD');

    const invRepo = AppDataSource.getRepository(Invoice);
    const msgRepo = AppDataSource.getRepository(WhatsappMessage);

    let queued = 0;

    // ── Pre-due reminder ──────────────────────────────────────────────
    const upcoming = await invRepo
      .createQueryBuilder('i')
      .where('i.companyId = :companyId', { companyId })
      .andWhere('i.dueDate = :targetDate', { targetDate })
      .andWhere('i.amountPaid < i.total')
      .andWhere(
        new Brackets((b) => {
          b.where('i.status = :acc', { acc: InvoiceStatus.ACCEPTED })
            .orWhere('i.status = :sub', { sub: InvoiceStatus.SUBMITTED });
        }),
      )
      .getMany();

    for (const inv of upcoming) {
      const alreadySent = await msgRepo
        .createQueryBuilder('m')
        .where('m.companyId = :companyId', { companyId })
        .andWhere('m.invoiceId = :invoiceId', { invoiceId: inv.id })
        .andWhere('m.template = :tpl', { tpl: WhatsappTemplate.PAYMENT_REMINDER })
        .andWhere('m.status != :failed', { failed: WhatsappStatus.FAILED })
        .andWhere('m.createdAt >= :since', {
          since: dayjs().startOf('day').toDate(),
        })
        .getCount();
      if (alreadySent > 0) continue;

      try {
        const r = await notificationService.queueInvoiceMessage({
          companyId,
          invoiceId: inv.id,
          template: WhatsappTemplate.PAYMENT_REMINDER,
        });
        if (r.queued) queued++;
      } catch (err) {
        logger.warn({ err, invoiceId: inv.id }, 'Failed to queue payment_reminder');
      }
    }

    // ── Overdue reminder ──────────────────────────────────────────────
    if (settings.sendOnOverdue) {
      const overdue = await invRepo
        .createQueryBuilder('i')
        .where('i.companyId = :companyId', { companyId })
        .andWhere('i.dueDate IS NOT NULL')
        .andWhere('i.dueDate < :today', { today })
        .andWhere('i.amountPaid < i.total')
        .andWhere(
          new Brackets((b) => {
            b.where('i.status = :acc', { acc: InvoiceStatus.ACCEPTED })
              .orWhere('i.status = :sub', { sub: InvoiceStatus.SUBMITTED })
              .orWhere('i.status = :ovd', { ovd: InvoiceStatus.OVERDUE });
          }),
        )
        .getMany();

      for (const inv of overdue) {
        const alreadySent = await msgRepo
          .createQueryBuilder('m')
          .where('m.companyId = :companyId', { companyId })
          .andWhere('m.invoiceId = :invoiceId', { invoiceId: inv.id })
          .andWhere('m.template = :tpl', { tpl: WhatsappTemplate.OVERDUE })
          .andWhere('m.status != :failed', { failed: WhatsappStatus.FAILED })
          .andWhere('m.createdAt >= :since', {
            since: dayjs().startOf('day').toDate(),
          })
          .getCount();
        if (alreadySent > 0) continue;

        try {
          const r = await notificationService.queueInvoiceMessage({
            companyId,
            invoiceId: inv.id,
            template: WhatsappTemplate.OVERDUE,
          });
          if (r.queued) queued++;
        } catch (err) {
          logger.warn({ err, invoiceId: inv.id }, 'Failed to queue overdue reminder');
        }
      }
    }

    return { queued, skipped: null as null };
  },

  async runAll() {
    const rows = await AppDataSource.getRepository(Invoice)
      .createQueryBuilder('i')
      .select('DISTINCT i.companyId', 'companyId')
      .getRawMany<{ companyId: string }>();

    const results: Array<{ companyId: string; queued: number }> = [];
    for (const { companyId } of rows) {
      try {
        const r = await this.runForCompany(companyId);
        results.push({ companyId, queued: r.queued });
      } catch (err) {
        logger.error({ err, companyId }, 'Reminders run failed');
      }
    }
    return results;
  },
};
