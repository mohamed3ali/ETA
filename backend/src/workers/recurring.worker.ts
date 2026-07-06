import { Worker } from 'bullmq';
import { redisOptions } from '../database/redis';
import { QUEUE_NAMES } from '../queues/queue-names';
import { RecurringTickJob, ensureRecurringSchedule } from '../queues/recurring.queue';
import { recurringInvoiceService } from '../modules/recurring/recurring-invoice.service';
import { logger } from '../config/logger';

export const startRecurringWorker = () => {
  const worker = new Worker<RecurringTickJob>(
    QUEUE_NAMES.RECURRING_TICK,
    async (job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Recurring invoice tick: generating due invoices');
      const results = await recurringInvoiceService.runDue();
      logger.info(
        { jobId: job.id, generated: results.length },
        'Recurring invoice tick complete',
      );
      return { generated: results.length, results };
    },
    {
      connection: redisOptions,
      concurrency: 1,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Recurring tick worker failed');
  });

  // Ensure the daily schedule is registered as soon as the worker boots.
  ensureRecurringSchedule().catch((err) =>
    logger.error({ err }, 'Failed to register recurring schedule'),
  );

  return worker;
};
