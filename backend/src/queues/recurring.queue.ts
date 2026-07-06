import { Queue, QueueEvents } from 'bullmq';
import { getRedis, redisOptions } from '../database/redis';
import { QUEUE_NAMES } from './queue-names';
import { logger } from '../config/logger';

export interface RecurringTickJob {
  // Reserved for future per-tenant fan-out. For now the daily tick is global.
  scheduledFor?: string;
}

// Daily at 00:05 UTC. Cron format: m h dom mon dow
const DAILY_TICK_CRON = '5 0 * * *';
const SCHEDULER_ID = 'recurring-daily-tick';

let _queue: Queue<RecurringTickJob> | null = null;
let _events: QueueEvents | null = null;

export const getRecurringQueue = (): Queue<RecurringTickJob> => {
  if (!_queue) {
    _queue = new Queue<RecurringTickJob>(QUEUE_NAMES.RECURRING_TICK, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 3600 * 24 * 7, count: 100 },
        removeOnFail: { age: 3600 * 24 * 30 },
      },
    });

    _events = new QueueEvents(QUEUE_NAMES.RECURRING_TICK, { connection: redisOptions });
    _events.on('completed', ({ jobId }) =>
      logger.info({ jobId }, 'Recurring tick completed'),
    );
    _events.on('failed', ({ jobId, failedReason }) =>
      logger.warn({ jobId, failedReason }, 'Recurring tick failed'),
    );
  }
  return _queue;
};

/**
 * Registers the daily 00:05 UTC scheduled job. Safe to call multiple times —
 * BullMQ upserts the scheduler by id so duplicates from multiple workers don't
 * cause repeated execution.
 */
export const ensureRecurringSchedule = async () => {
  const queue = getRecurringQueue();
  await queue.upsertJobScheduler(
    SCHEDULER_ID,
    { pattern: DAILY_TICK_CRON, tz: 'UTC' },
    { name: 'daily', data: {}, opts: { removeOnComplete: { age: 3600 * 24 * 7 } } },
  );
  logger.info({ cron: DAILY_TICK_CRON, tz: 'UTC' }, 'Recurring invoice scheduler ensured');
};

export const enqueueRecurringTickNow = async () => {
  await getRecurringQueue().add('manual', { scheduledFor: new Date().toISOString() });
};
