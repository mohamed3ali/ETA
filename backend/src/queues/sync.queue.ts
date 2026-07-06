import { Queue } from 'bullmq';
import { getRedis } from '../database/redis';
import { QUEUE_NAMES } from './queue-names';

export interface InvoiceSyncJob {
  companyId: string;
  uuid: string;
}

let _queue: Queue<InvoiceSyncJob> | null = null;

export const getSyncQueue = (): Queue<InvoiceSyncJob> => {
  if (!_queue) {
    _queue = new Queue<InvoiceSyncJob>(QUEUE_NAMES.INVOICE_SYNC, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { age: 3600 * 24 },
      },
    });
  }
  return _queue;
};
