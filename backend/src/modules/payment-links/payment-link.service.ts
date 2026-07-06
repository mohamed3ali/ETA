import { customAlphabet } from 'nanoid';
import dayjs from 'dayjs';

import { AppDataSource } from '../../database/data-source';
import { env } from '../../config/env';
import { HttpError } from '../../common/errors/HttpError';
import { logger } from '../../config/logger';

import { Invoice, InvoiceStatus } from '../invoices/invoice.entity';
import { Customer } from '../customers/customer.entity';
import { Company } from '../companies/company.entity';
import { Payment, PaymentMethod } from '../payments/payment.entity';
import { InvoiceLog, InvoiceLogAction } from '../invoices/invoice-log.entity';

import {
  PaymentLink,
  PaymentLinkProvider,
  PaymentLinkStatus,
} from './payment-link.entity';
import { paymobAdapter } from './paymob.adapter';
import { notificationService } from '../notifications/notification.service';
import { WhatsappTemplate } from '../notifications/whatsapp-message.entity';

const repo = () => AppDataSource.getRepository(PaymentLink);
const newToken = customAlphabet(
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789',
  32,
);

interface CreateInput {
  invoiceId: string;
  amount?: number;
  expiresInDays?: number;
  provider?: PaymentLinkProvider;
  sendWhatsapp?: boolean;
}

export const paymentLinkService = {
  async create(companyId: string, userId: string, input: CreateInput) {
    const invoice = await AppDataSource.getRepository(Invoice).findOne({
      where: { id: input.invoiceId, companyId },
      relations: ['customer'],
    });
    if (!invoice) throw HttpError.notFound('Invoice not found');
    if (invoice.status === InvoiceStatus.PAID) {
      throw HttpError.badRequest('Invoice is already paid');
    }

    const due = Math.max(0, Number(invoice.total) - Number(invoice.amountPaid));
    if (due <= 0) throw HttpError.badRequest('Nothing left to pay');

    const amount = Math.min(due, Number(input.amount ?? due));
    if (amount <= 0) throw HttpError.badRequest('Amount must be positive');

    const provider = input.provider ?? PaymentLinkProvider.PAYMOB;
    const token = newToken();
    const expiresAt = dayjs()
      .add(input.expiresInDays ?? 14, 'day')
      .toDate();

    const customer = invoice.customer as Customer | undefined;

    const publicBase = (env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const fallbackUrl = `${publicBase}/pay/${token}`;
    const webhookBase = (env.PUBLIC_API_URL || `http://localhost:${env.API_PORT}${env.API_PREFIX}`).replace(/\/$/, '');
    const webhookUrl = `${webhookBase}/public/pay/${token}/webhook`;

    let checkoutUrl = fallbackUrl;
    let providerRef: string | null = null;
    let usedProvider = provider;

    if (provider === PaymentLinkProvider.PAYMOB) {
      try {
        const intention = await paymobAdapter.createIntention({
          amountMinor: Math.round(amount * 100),
          currency: invoice.currency,
          redirectionUrl: fallbackUrl,
          webhookUrl,
          reference: `INV-${invoice.invoiceNumber}-${token.slice(0, 6)}`,
          billing: {
            name: customer?.name ?? 'Customer',
            email: customer?.email,
            phone: customer?.phone,
          },
        });
        checkoutUrl = intention.checkoutUrl;
        providerRef = intention.providerRef;
        if (intention.mock) usedProvider = PaymentLinkProvider.MOCK;
      } catch (err) {
        logger.error({ err }, 'Paymob intention creation failed — falling back to mock link');
        usedProvider = PaymentLinkProvider.MOCK;
      }
    }

    const link = repo().create({
      companyId,
      invoiceId: invoice.id,
      token,
      amount,
      currency: invoice.currency,
      status: PaymentLinkStatus.PENDING,
      provider: usedProvider,
      providerRef,
      checkoutUrl,
      expiresAt,
      createdById: userId,
    });
    await repo().save(link);

    if (input.sendWhatsapp) {
      await notificationService.queueInvoiceMessage({
        companyId,
        invoiceId: invoice.id,
        template: WhatsappTemplate.PAYMENT_LINK,
        extraVars: { link: checkoutUrl },
      });
    }

    return link;
  },

  async listByInvoice(companyId: string, invoiceId: string) {
    return repo().find({
      where: { companyId, invoiceId },
      order: { createdAt: 'DESC' },
    });
  },

  async getByToken(token: string) {
    return repo().findOne({ where: { token } });
  },

  /**
   * Public-facing detail used by the customer payment page. Strips any
   * internal-only fields and joins the minimum invoice + company metadata
   * needed to render a receipt.
   */
  async getPublicByToken(token: string) {
    const link = await repo().findOne({ where: { token } });
    if (!link) throw HttpError.notFound('Payment link not found');
    const invoice = await AppDataSource.getRepository(Invoice).findOne({
      where: { id: link.invoiceId },
    });
    const company = await AppDataSource.getRepository(Company).findOne({
      where: { id: link.companyId },
    });
    if (!invoice || !company) throw HttpError.notFound('Payment link expired');

    if (link.status === PaymentLinkStatus.PENDING && link.expiresAt && link.expiresAt < new Date()) {
      link.status = PaymentLinkStatus.EXPIRED;
      await repo().save(link);
    }

    return {
      token: link.token,
      amount: Number(link.amount),
      currency: link.currency,
      status: link.status,
      provider: link.provider,
      checkoutUrl: link.checkoutUrl,
      expiresAt: link.expiresAt,
      paidAt: link.paidAt,
      invoice: {
        number: invoice.invoiceNumber,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        total: Number(invoice.total),
        currency: invoice.currency,
      },
      company: {
        name: company.name,
        logoUrl: company.logoUrl,
      },
    };
  },

  async cancel(companyId: string, id: string) {
    const link = await repo().findOne({ where: { id, companyId } });
    if (!link) throw HttpError.notFound('Payment link not found');
    if (link.status !== PaymentLinkStatus.PENDING) {
      throw HttpError.badRequest('Only pending links can be cancelled');
    }
    link.status = PaymentLinkStatus.CANCELLED;
    await repo().save(link);
    return link;
  },

  /**
   * Finalize a payment-link as paid. Creates the matching Payment row,
   * advances the invoice balance, and is idempotent — calling it twice for
   * the same link is a no-op after the first success.
   *
   * Used by:
   *   - the mock "Confirm payment" button on the public page
   *   - the real provider webhook (Paymob notification_url)
   */
  async markPaid(token: string, source: { providerRef?: string; mock?: boolean }) {
    return AppDataSource.transaction(async (manager) => {
      const link = await manager.getRepository(PaymentLink).findOne({ where: { token } });
      if (!link) throw HttpError.notFound('Payment link not found');
      if (link.status === PaymentLinkStatus.PAID) return link;
      if (link.status !== PaymentLinkStatus.PENDING) {
        throw HttpError.badRequest('Payment link is not payable');
      }

      const inv = await manager.getRepository(Invoice).findOne({
        where: { id: link.invoiceId, companyId: link.companyId },
      });
      if (!inv) throw HttpError.notFound('Invoice not found');

      const payment = manager.getRepository(Payment).create({
        invoiceId: inv.id,
        companyId: link.companyId,
        amount: Number(link.amount),
        currency: link.currency,
        method: source.mock ? PaymentMethod.OTHER : PaymentMethod.CARD,
        paidAt: new Date().toISOString().slice(0, 10),
        reference: source.providerRef ?? link.providerRef ?? `LINK-${token}`,
        notes: source.mock ? 'Paid via payment link (mock)' : 'Paid via payment link',
      });
      await manager.getRepository(Payment).save(payment);

      inv.amountPaid = Number(inv.amountPaid) + Number(link.amount);
      if (inv.amountPaid >= Number(inv.total)) {
        inv.status = InvoiceStatus.PAID;
      }
      await manager.getRepository(Invoice).save(inv);

      link.status = PaymentLinkStatus.PAID;
      link.paidAt = new Date();
      if (source.providerRef) link.providerRef = source.providerRef;
      await manager.getRepository(PaymentLink).save(link);

      await manager.getRepository(InvoiceLog).save(
        manager.getRepository(InvoiceLog).create({
          invoiceId: inv.id,
          action: InvoiceLogAction.PAYMENT_RECORDED,
          meta: {
            amount: Number(link.amount),
            source: 'payment_link',
            mock: !!source.mock,
            providerRef: source.providerRef,
          },
        }),
      );

      // Fire-and-forget "thank you" message
      notificationService
        .queueInvoiceMessage({
          companyId: link.companyId,
          invoiceId: inv.id,
          template: WhatsappTemplate.PAYMENT_RECEIVED,
        })
        .catch((err) => logger.warn({ err }, 'Failed to queue payment_received WhatsApp'));

      return link;
    });
  },
};
