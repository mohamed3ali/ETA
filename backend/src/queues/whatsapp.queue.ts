import { Queue } from 'bullmq';
import { getRedis } from '../database/redis';
import { QUEUE_NAMES } from './queue-names';

export type WhatsappTemplateName =
  | 'invoice_sent'
  | 'payment_reminder'
  | 'payment_received'
  | 'overdue'
  | 'payment_link';

export interface WhatsappJob {
  companyId: string;
  to: string; // E.164 phone
  template: WhatsappTemplateName;
  variables: Record<string, string>;
  invoiceId?: string;
  /** When set, the worker will mark this whatsapp_messages row after send. */
  messageId?: string;
  /** Pre-formatted body (used by mock provider and for logs). */
  body?: string;
}

let _queue: Queue<WhatsappJob> | null = null;

export const getWhatsappQueue = (): Queue<WhatsappJob> => {
  if (!_queue) {
    _queue = new Queue<WhatsappJob>(QUEUE_NAMES.WHATSAPP_SEND, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 3600 * 24 * 3 },
        removeOnFail: { age: 3600 * 24 * 14 },
      },
    });
  }
  return _queue;
};

export const enqueueWhatsapp = async (data: WhatsappJob) => {
  await getWhatsappQueue().add('send', data);
};
