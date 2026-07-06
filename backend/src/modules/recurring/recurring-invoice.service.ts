import { Brackets, EntityManager, LessThanOrEqual } from 'typeorm';
import dayjs from 'dayjs';

import { AppDataSource } from '../../database/data-source';
import { HttpError } from '../../common/errors/HttpError';
import { buildPage } from '../../common/utils/pagination';
import { logger } from '../../config/logger';

import {
  RecurringInvoice,
  RecurringPeriod,
  RecurringItem,
} from './recurring-invoice.entity';
import {
  CreateRecurringInput,
  FromInvoiceInput,
  ListRecurringQuery,
  UpdateRecurringInput,
} from './recurring-invoice.dto';

import { Customer } from '../customers/customer.entity';
import { Invoice, InvoiceStatus } from '../invoices/invoice.entity';
import { InvoiceItem } from '../invoices/invoice-item.entity';
import { InvoiceLog, InvoiceLogAction } from '../invoices/invoice-log.entity';
import { calculateInvoiceTotals } from '../invoices/invoice-calculator';
import { generateInvoiceNumber } from '../invoices/invoice-numbering';
import { enqueueInvoiceSubmission } from '../../queues/invoice.queue';

const repo = () => AppDataSource.getRepository(RecurringInvoice);

const advanceDate = (date: string, period: RecurringPeriod): string => {
  const d = dayjs(date);
  switch (period) {
    case RecurringPeriod.WEEKLY:
      return d.add(1, 'week').format('YYYY-MM-DD');
    case RecurringPeriod.MONTHLY:
      return d.add(1, 'month').format('YYYY-MM-DD');
    case RecurringPeriod.QUARTERLY:
      return d.add(3, 'month').format('YYYY-MM-DD');
    case RecurringPeriod.YEARLY:
      return d.add(1, 'year').format('YYYY-MM-DD');
  }
};

const normalizeItems = (items: RecurringItem[]): RecurringItem[] =>
  items.map((it) => ({
    productId: it.productId ?? null,
    description: it.description,
    etaItemCode: it.etaItemCode ?? null,
    etaCodeType: it.etaCodeType ?? 'GS1',
    unitType: it.unitType ?? 'EA',
    quantity: Number(it.quantity),
    unitPrice: Number(it.unitPrice),
    discount: Number(it.discount ?? 0),
    taxRate: Number(it.taxRate ?? 14),
  }));

export const recurringInvoiceService = {
  async list(companyId: string, q: ListRecurringQuery) {
    const qb = repo()
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.customer', 'customer')
      .leftJoinAndSelect('r.branch', 'branch')
      .where('r.companyId = :companyId', { companyId });

    if (q.customerId) qb.andWhere('r.customerId = :customerId', { customerId: q.customerId });
    if (q.period) qb.andWhere('r.period = :period', { period: q.period });
    if (q.isActive !== undefined) qb.andWhere('r.isActive = :isActive', { isActive: q.isActive });

    if (q.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('r.name LIKE :s', { s: `%${q.search}%` }).orWhere('customer.name LIKE :s', {
            s: `%${q.search}%`,
          });
        }),
      );
    }

    const allowed = ['createdAt', 'nextRunDate', 'period', 'isActive'];
    const sortBy = allowed.includes(q.sortBy ?? '') ? q.sortBy! : 'nextRunDate';
    qb.orderBy(`r.${sortBy}`, q.sortDir);

    const [items, total] = await qb
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();

    return buildPage(items, total, q as any);
  },

  async getById(companyId: string, id: string) {
    const r = await repo().findOne({
      where: { id, companyId },
      relations: ['customer', 'branch'],
    });
    if (!r) throw HttpError.notFound('Recurring invoice not found');
    return r;
  },

  async create(companyId: string, userId: string, input: CreateRecurringInput) {
    const customer = await AppDataSource.getRepository(Customer).findOne({
      where: { id: input.customerId, companyId },
    });
    if (!customer) throw HttpError.notFound('Customer not found');

    const entity = repo().create({
      companyId,
      createdById: userId,
      name: input.name ?? null,
      customerId: input.customerId,
      branchId: input.branchId ?? null,
      type: input.type,
      period: input.period,
      nextRunDate: input.nextRunDate,
      autoSubmit: input.autoSubmit,
      isActive: input.isActive,
      currency: input.currency,
      notes: input.notes ?? null,
      items: normalizeItems(input.items),
    });
    await repo().save(entity);
    return this.getById(companyId, entity.id);
  },

  async update(companyId: string, id: string, input: UpdateRecurringInput) {
    const r = await repo().findOne({ where: { id, companyId } });
    if (!r) throw HttpError.notFound('Recurring invoice not found');

    if (input.customerId) {
      const customer = await AppDataSource.getRepository(Customer).findOne({
        where: { id: input.customerId, companyId },
      });
      if (!customer) throw HttpError.notFound('Customer not found');
      r.customerId = input.customerId;
    }
    if (input.name !== undefined) r.name = input.name ?? null;
    if (input.branchId !== undefined) r.branchId = input.branchId ?? null;
    if (input.type) r.type = input.type;
    if (input.period) r.period = input.period;
    if (input.nextRunDate) r.nextRunDate = input.nextRunDate;
    if (input.autoSubmit !== undefined) r.autoSubmit = input.autoSubmit;
    if (input.isActive !== undefined) r.isActive = input.isActive;
    if (input.currency) r.currency = input.currency;
    if (input.notes !== undefined) r.notes = input.notes ?? null;
    if (input.items) r.items = normalizeItems(input.items);

    await repo().save(r);
    return this.getById(companyId, r.id);
  },

  async toggleActive(companyId: string, id: string, isActive: boolean) {
    const r = await repo().findOne({ where: { id, companyId } });
    if (!r) throw HttpError.notFound('Recurring invoice not found');
    r.isActive = isActive;
    await repo().save(r);
    return r;
  },

  async remove(companyId: string, id: string) {
    const r = await repo().findOne({ where: { id, companyId } });
    if (!r) throw HttpError.notFound('Recurring invoice not found');
    await repo().softRemove(r);
    return { id };
  },

  /**
   * Create a recurring template by cloning an existing invoice's customer,
   * branch, items, currency and notes.
   */
  async createFromInvoice(
    companyId: string,
    userId: string,
    invoiceId: string,
    input: FromInvoiceInput,
  ) {
    const inv = await AppDataSource.getRepository(Invoice).findOne({
      where: { id: invoiceId, companyId },
      relations: ['items'],
    });
    if (!inv) throw HttpError.notFound('Invoice not found');
    if (!inv.items?.length) throw HttpError.badRequest('Invoice has no line items');

    const items: RecurringItem[] = inv.items.map((it) => ({
      productId: it.productId ?? null,
      description: it.description,
      etaItemCode: it.etaItemCode ?? null,
      etaCodeType: it.etaCodeType,
      unitType: it.unitType,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      discount: Number(it.discount),
      taxRate: Number(it.taxRate),
    }));

    const entity = repo().create({
      companyId,
      createdById: userId,
      name: input.name ?? `From ${inv.invoiceNumber}`,
      customerId: inv.customerId,
      branchId: inv.branchId ?? null,
      type: inv.type,
      period: input.period,
      nextRunDate: input.nextRunDate,
      autoSubmit: input.autoSubmit,
      isActive: input.isActive,
      currency: inv.currency,
      notes: inv.notes ?? null,
      items,
    });
    await repo().save(entity);
    return this.getById(companyId, entity.id);
  },

  /**
   * Manually trigger generation for a single recurring template (used by the
   * "Run now" button and as the building block of the daily cron).
   */
  async runOne(recurringId: string): Promise<{ invoiceId: string; queued: boolean } | null> {
    const r = await repo().findOne({ where: { id: recurringId } });
    if (!r || !r.isActive) return null;
    return this._generateAndAdvance(r);
  },

  /**
   * Cron entry point. Called by the daily scheduler (00:05 UTC).
   * Finds every active template where nextRunDate <= today and generates
   * the matching invoice(s), advancing the next-run date.
   */
  async runDue(today: string = dayjs().format('YYYY-MM-DD')) {
    const due = await repo().find({
      where: {
        isActive: true,
        nextRunDate: LessThanOrEqual(today),
      },
    });

    logger.info({ count: due.length, today }, 'Recurring invoices due for generation');

    const results: Array<{ recurringId: string; invoiceId: string; queued: boolean }> = [];
    for (const r of due) {
      try {
        // A template can be "behind" multiple cycles (e.g. server downtime).
        // Generate once per missed cycle until nextRunDate > today.
        // Guard with a hard cap to avoid runaway generation on bad data.
        let safety = 24;
        let current = r;
        while (current.isActive && current.nextRunDate <= today && safety-- > 0) {
          const outcome = await this._generateAndAdvance(current);
          if (!outcome) break;
          results.push({ recurringId: r.id, ...outcome });
          current = (await repo().findOne({ where: { id: r.id } }))!;
        }
      } catch (err) {
        logger.error({ err, recurringId: r.id }, 'Failed to generate recurring invoice');
      }
    }
    return results;
  },

  async _generateAndAdvance(
    r: RecurringInvoice,
  ): Promise<{ invoiceId: string; queued: boolean }> {
    const issueDate = r.nextRunDate;

    const invoiceId = await AppDataSource.transaction(async (manager: EntityManager) => {
      const totals = calculateInvoiceTotals(
        r.items.map((it) => ({
          ...it,
          etaItemCode: it.etaItemCode ?? undefined,
          productId: it.productId ?? undefined,
        })),
      );
      const invoiceNumber = await generateInvoiceNumber(manager, r.companyId, issueDate);

      const invoice = manager.getRepository(Invoice).create({
        companyId: r.companyId,
        customerId: r.customerId,
        branchId: r.branchId ?? null,
        createdById: r.createdById ?? null,
        recurringId: r.id,
        isAutoGenerated: true,
        type: r.type,
        status: InvoiceStatus.DRAFT,
        invoiceNumber,
        issueDate,
        dueDate: null,
        currency: r.currency,
        notes: r.notes ?? undefined,
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        totalTax: totals.totalTax,
        total: totals.total,
      });
      await manager.getRepository(Invoice).save(invoice);

      const items = totals.lines.map((l) =>
        manager.getRepository(InvoiceItem).create({
          invoiceId: invoice.id,
          productId: l.productId ?? undefined,
          description: l.description,
          etaItemCode: l.etaItemCode,
          etaCodeType: l.etaCodeType,
          unitType: l.unitType,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          taxRate: l.taxRate,
          taxAmount: l.taxAmount,
          lineTotal: l.lineTotal,
        }),
      );
      await manager.getRepository(InvoiceItem).save(items);

      await manager.getRepository(InvoiceLog).save(
        manager.getRepository(InvoiceLog).create({
          invoiceId: invoice.id,
          userId: r.createdById ?? null,
          action: InvoiceLogAction.CREATED,
          meta: {
            invoiceNumber: invoice.invoiceNumber,
            total: invoice.total,
            recurringId: r.id,
            autoGenerated: true,
          },
        }),
      );

      // Advance schedule + bookkeeping on the recurring template
      const recRepo = manager.getRepository(RecurringInvoice);
      r.lastRunAt = new Date();
      r.generatedCount = (r.generatedCount ?? 0) + 1;
      r.nextRunDate = advanceDate(issueDate, r.period);
      await recRepo.save(r);

      return invoice.id;
    });

    let queued = false;
    if (r.autoSubmit) {
      // Mark as submitted then enqueue. We do this outside the transaction so a
      // failure in the queue layer doesn't roll back the invoice itself.
      const inv = await AppDataSource.getRepository(Invoice).findOneOrFail({
        where: { id: invoiceId },
      });
      inv.status = InvoiceStatus.SUBMITTED;
      await AppDataSource.getRepository(Invoice).save(inv);

      await enqueueInvoiceSubmission({ invoiceId, companyId: r.companyId });
      queued = true;

      const logRepo = AppDataSource.getRepository(InvoiceLog);
      await logRepo.save(
        logRepo.create({
          invoiceId,
          userId: r.createdById ?? null,
          action: InvoiceLogAction.SUBMITTED_TO_ETA,
          meta: { source: 'recurring', recurringId: r.id },
        }),
      );
    }

    return { invoiceId, queued };
  },
};
