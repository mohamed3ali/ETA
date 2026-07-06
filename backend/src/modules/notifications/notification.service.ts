import { AppDataSource } from '../../database/data-source';
import { NotificationSettings } from './notification-settings.entity';
import {
  WhatsappMessage,
  WhatsappStatus,
  WhatsappTemplate,
} from './whatsapp-message.entity';
import { Invoice } from '../invoices/invoice.entity';
import { Customer } from '../customers/customer.entity';
import { Company } from '../companies/company.entity';
import { InvoiceLog, InvoiceLogAction } from '../invoices/invoice-log.entity';
import { enqueueWhatsapp } from '../../queues/whatsapp.queue';
import { formatTemplate } from './notification.templates';
import { HttpError } from '../../common/errors/HttpError';
import { logger } from '../../config/logger';

const settingsRepo = () => AppDataSource.getRepository(NotificationSettings);
const messagesRepo = () => AppDataSource.getRepository(WhatsappMessage);

export const notificationService = {
  /** Read (or lazily create) the per-company settings row. */
  async getSettings(companyId: string): Promise<NotificationSettings> {
    let s = await settingsRepo().findOne({ where: { companyId } });
    if (!s) {
      s = settingsRepo().create({ companyId });
      await settingsRepo().save(s);
    }
    return s;
  },

  async updateSettings(companyId: string, input: Partial<NotificationSettings>) {
    const s = await this.getSettings(companyId);
    Object.assign(s, input);
    await settingsRepo().save(s);
    return s;
  },

  /**
   * Resolves the customer phone for an invoice and either enqueues the
   * WhatsApp send (when the customer has a phone) or returns `skipped` so the
   * caller can surface a useful message in the UI.
   */
  async queueInvoiceMessage(opts: {
    companyId: string;
    invoiceId: string;
    template: WhatsappTemplate;
    extraVars?: Record<string, string>;
  }): Promise<{ queued: boolean; messageId?: string; reason?: string }> {
    const settings = await this.getSettings(opts.companyId);
    if (!settings.whatsappEnabled) {
      return { queued: false, reason: 'whatsapp_disabled' };
    }

    const invoice = await AppDataSource.getRepository(Invoice).findOne({
      where: { id: opts.invoiceId, companyId: opts.companyId },
      relations: ['customer', 'company'],
    });
    if (!invoice) throw HttpError.notFound('Invoice not found');

    const customer = invoice.customer as Customer | undefined;
    if (!customer?.phone) {
      return { queued: false, reason: 'no_customer_phone' };
    }

    const company = (invoice as any).company as Company | undefined;
    const override = settings.templates?.[opts.template] ?? null;

    const baseVars: Record<string, string> = {
      customer: customer.name,
      number: invoice.invoiceNumber,
      amount: Number(invoice.total).toFixed(2),
      currency: invoice.currency,
      due: invoice.dueDate ?? invoice.issueDate,
      company: company?.name ?? '',
      ...(opts.extraVars ?? {}),
    };

    const body = formatTemplate(opts.template, baseVars, override);

    const log = messagesRepo().create({
      companyId: opts.companyId,
      invoiceId: opts.invoiceId,
      template: opts.template,
      toPhone: customer.phone,
      status: WhatsappStatus.QUEUED,
      variables: baseVars,
      body,
    });
    await messagesRepo().save(log);

    await enqueueWhatsapp({
      companyId: opts.companyId,
      to: customer.phone,
      template: opts.template as
        | 'invoice_sent'
        | 'payment_reminder'
        | 'payment_received'
        | 'overdue',
      variables: baseVars,
      invoiceId: opts.invoiceId,
      messageId: log.id,
      body,
    });

    return { queued: true, messageId: log.id };
  },

  async listMessagesByInvoice(companyId: string, invoiceId: string) {
    return messagesRepo().find({
      where: { companyId, invoiceId },
      order: { createdAt: 'DESC' },
    });
  },

  async listMessages(companyId: string, limit = 50) {
    return messagesRepo().find({
      where: { companyId },
      order: { createdAt: 'DESC' },
      take: Math.min(200, Math.max(1, limit)),
    });
  },

  /**
   * Worker callback — updates the audit row and adds an invoice log entry
   * when a WhatsApp send finishes (success or failure). Safe to call when
   * `messageId` is undefined (e.g. legacy in-flight jobs).
   */
  async markMessageOutcome(
    messageId: string | undefined,
    outcome: { ok: boolean; mock?: boolean; error?: string },
  ) {
    if (!messageId) return;
    const msg = await messagesRepo().findOne({ where: { id: messageId } });
    if (!msg) return;
    msg.status = outcome.ok ? WhatsappStatus.SENT : WhatsappStatus.FAILED;
    msg.sentAt = outcome.ok ? new Date() : msg.sentAt;
    msg.errorMessage = outcome.error ?? null;
    msg.mock = !!outcome.mock;
    await messagesRepo().save(msg);

    if (outcome.ok && msg.invoiceId) {
      try {
        const logRepo = AppDataSource.getRepository(InvoiceLog);
        await logRepo.save(
          logRepo.create({
            invoiceId: msg.invoiceId,
            action: InvoiceLogAction.WHATSAPP_SENT,
            meta: { template: msg.template, to: msg.toPhone, mock: !!outcome.mock },
          }),
        );
      } catch (err) {
        logger.warn({ err }, 'Failed to write WhatsApp invoice log');
      }
    }
  },
};
