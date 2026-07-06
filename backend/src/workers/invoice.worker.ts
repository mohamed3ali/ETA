import { Worker } from 'bullmq';
import { redisOptions } from '../database/redis';
import { QUEUE_NAMES } from '../queues/queue-names';
import { InvoiceSubmitJob } from '../queues/invoice.queue';
import { etaService } from '../modules/eta/eta.service';
import { logger } from '../config/logger';

export const startInvoiceWorker = () => {
  const worker = new Worker<InvoiceSubmitJob>(
    QUEUE_NAMES.INVOICE_SUBMIT,
    async (job) => {
      const { invoiceId, companyId } = job.data;
      logger.info({ jobId: job.id, invoiceId }, 'Processing invoice submission');
      const outcome = await etaService.submitInvoice(invoiceId, companyId);
      if (!outcome.success) {
        // Throw so BullMQ retries until attempts are exhausted
        throw new Error(`ETA rejected invoice: ${JSON.stringify(outcome.errors)}`);
      }
      return outcome;
    },
    {
      connection: redisOptions,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Invoice submit worker failed');
  });

  return worker;
};
