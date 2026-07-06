import { Queue, QueueEvents } from 'bullmq';
import { getRedis, redisOptions } from '../database/redis';
import { QUEUE_NAMES } from './queue-names';
import { logger } from '../config/logger';

export interface InvoiceSubmitJob {
  invoiceId: string;
  companyId: string;
}

let _queue: Queue<InvoiceSubmitJob> | null = null;
let _events: QueueEvents | null = null;

export const getInvoiceQueue = (): Queue<InvoiceSubmitJob> => {
  if (!_queue) {
    _queue = new Queue<InvoiceSubmitJob>(QUEUE_NAMES.INVOICE_SUBMIT, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 3600 * 24, count: 1000 },
        removeOnFail: { age: 3600 * 24 * 7 },
      },
    });

    _events = new QueueEvents(QUEUE_NAMES.INVOICE_SUBMIT, { connection: redisOptions });
    _events.on('completed', ({ jobId }) =>
      logger.info({ jobId }, 'Invoice submit job completed'),
    );
    _events.on('failed', ({ jobId, failedReason }) =>
      logger.warn({ jobId, failedReason }, 'Invoice submit job failed'),
    );
  }
  return _queue;
};

export const enqueueInvoiceSubmission = async (data: InvoiceSubmitJob) => {
  await getInvoiceQueue().add('submit', data, { jobId: `submit-${data.invoiceId}` });
};
