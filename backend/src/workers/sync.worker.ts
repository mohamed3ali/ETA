import { Worker } from 'bullmq';
import { redisOptions } from '../database/redis';
import { QUEUE_NAMES } from '../queues/queue-names';
import { InvoiceSyncJob } from '../queues/sync.queue';
import { etaService } from '../modules/eta/eta.service';
import { logger } from '../config/logger';

export const startSyncWorker = () => {
  const worker = new Worker<InvoiceSyncJob>(
    QUEUE_NAMES.INVOICE_SYNC,
    async (job) => {
      const status = await etaService.fetchInvoiceStatus(job.data.companyId, job.data.uuid);
      logger.info({ jobId: job.id, uuid: job.data.uuid }, 'Synced ETA status');
      return status;
    },
    { connection: redisOptions, concurrency: 3 },
  );

  worker.on('failed', (job, err) =>
    logger.warn({ jobId: job?.id, err: err.message }, 'sync worker failed'),
  );
  return worker;
};
