import { Brackets } from 'typeorm';
import { AppDataSource } from '../../database/data-source';
import { Payment } from './payment.entity';
import { Invoice, InvoiceStatus } from '../invoices/invoice.entity';
import { InvoiceLog, InvoiceLogAction } from '../invoices/invoice-log.entity';
import { CreatePaymentInput, ListPaymentQuery } from './payment.dto';
import { HttpError } from '../../common/errors/HttpError';
import { buildPage } from '../../common/utils/pagination';
import { notificationService } from '../notifications/notification.service';
import { WhatsappTemplate } from '../notifications/whatsapp-message.entity';
import { NotificationSettings } from '../notifications/notification-settings.entity';
import { logger } from '../../config/logger';

export const paymentService = {
  async create(companyId: string, userId: string, input: CreatePaymentInput) {
    return AppDataSource.transaction(async (manager) => {
      const inv = await manager.getRepository(Invoice).findOne({
        where: { id: input.invoiceId, companyId },
      });
      if (!inv) throw HttpError.notFound('Invoice not found');

      const payment = manager.getRepository(Payment).create({
        ...input,
        companyId,
      });
      await manager.getRepository(Payment).save(payment);

      inv.amountPaid = Number(inv.amountPaid) + Number(input.amount);
      if (inv.amountPaid >= Number(inv.total)) {
        inv.status = InvoiceStatus.PAID;
      }
      await manager.getRepository(Invoice).save(inv);

      const logRepo = manager.getRepository(InvoiceLog);
      await logRepo.save(
        logRepo.create({
          invoiceId: inv.id,
          userId,
          action: InvoiceLogAction.PAYMENT_RECORDED,
          meta: { amount: input.amount, method: input.method },
        }),
      );

      // Send "thank you" WhatsApp when the invoice is fully paid.
      if (inv.status === InvoiceStatus.PAID) {
        const settings = await manager.getRepository(NotificationSettings).findOne({
          where: { companyId },
        });
        if (!settings || (settings.whatsappEnabled && settings.sendOnPaid)) {
          notificationService
            .queueInvoiceMessage({
              companyId,
              invoiceId: inv.id,
              template: WhatsappTemplate.PAYMENT_RECEIVED,
            })
            .catch((err) =>
              logger.warn({ err }, 'Failed to queue payment_received WhatsApp'),
            );
        }
      }

      return payment;
    });
  },

  async listByInvoice(companyId: string, invoiceId: string) {
    return AppDataSource.getRepository(Payment).find({
      where: { companyId, invoiceId },
      order: { paidAt: 'DESC' },
    });
  },

  async list(companyId: string, q: ListPaymentQuery) {
    const qb = AppDataSource.getRepository(Payment)
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.invoice', 'invoice')
      .leftJoinAndSelect('invoice.customer', 'customer')
      .where('p.companyId = :companyId', { companyId });

    if (q.method) qb.andWhere('p.method = :method', { method: q.method });
    if (q.invoiceId) qb.andWhere('p.invoiceId = :invoiceId', { invoiceId: q.invoiceId });
    if (q.customerId) qb.andWhere('invoice.customerId = :customerId', { customerId: q.customerId });
    if (q.from) qb.andWhere('p.paidAt >= :from', { from: q.from });
    if (q.to) qb.andWhere('p.paidAt <= :to', { to: q.to });

    if (q.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('p.reference LIKE :s', { s: `%${q.search}%` })
            .orWhere('invoice.invoiceNumber LIKE :s', { s: `%${q.search}%` })
            .orWhere('customer.name LIKE :s', { s: `%${q.search}%` });
        }),
      );
    }

    const allowed = ['paidAt', 'amount', 'createdAt', 'method'];
    const sortBy = allowed.includes(q.sortBy ?? '') ? q.sortBy! : 'paidAt';
    qb.orderBy(`p.${sortBy}`, q.sortDir);

    const [items, total] = await qb
      .skip((q.page - 1) * q.limit)
      .take(q.limit)
      .getManyAndCount();

    return buildPage(items, total, q as any);
  },

  async summary(companyId: string, q: ListPaymentQuery) {
    const qb = AppDataSource.getRepository(Payment)
      .createQueryBuilder('p')
      .leftJoin('p.invoice', 'invoice')
      .leftJoin('invoice.customer', 'customer')
      .where('p.companyId = :companyId', { companyId });

    if (q.method) qb.andWhere('p.method = :method', { method: q.method });
    if (q.invoiceId) qb.andWhere('p.invoiceId = :invoiceId', { invoiceId: q.invoiceId });
    if (q.customerId) qb.andWhere('invoice.customerId = :customerId', { customerId: q.customerId });
    if (q.from) qb.andWhere('p.paidAt >= :from', { from: q.from });
    if (q.to) qb.andWhere('p.paidAt <= :to', { to: q.to });
    if (q.search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('p.reference LIKE :s', { s: `%${q.search}%` })
            .orWhere('invoice.invoiceNumber LIKE :s', { s: `%${q.search}%` })
            .orWhere('customer.name LIKE :s', { s: `%${q.search}%` });
        }),
      );
    }

    const row = await qb
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .addSelect('COUNT(p.id)', 'count')
      .getRawOne<{ total: string; count: string }>();

    return {
      total: Number(row?.total ?? 0),
      count: Number(row?.count ?? 0),
    };
  },
};
