import { Queue, QueueEvents } from 'bullmq';
import { getRedis, redisOptions } from '../database/redis';
import { QUEUE_NAMES } from './queue-names';
import { logger } from '../config/logger';

export interface RemindersTickJob {
  scheduledFor?: string;
}

const DAILY_TICK_CRON = '0 7 * * *'; // 07:00 UTC ≈ 10:00 Cairo
const SCHEDULER_ID = 'reminders-alerts-daily-tick';

let _queue: Queue<RemindersTickJob> | null = null;
let _events: QueueEvents | null = null;

export const getRemindersQueue = (): Queue<RemindersTickJob> => {
  if (!_queue) {
    _queue = new Queue<RemindersTickJob>(QUEUE_NAMES.REMINDERS_TICK, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 3600 * 24 * 7, count: 100 },
        removeOnFail: { age: 3600 * 24 * 30 },
      },
    });

    _events = new QueueEvents(QUEUE_NAMES.REMINDERS_TICK, { connection: redisOptions });
    _events.on('completed', ({ jobId }) =>
      logger.info({ jobId }, 'Reminders/alerts tick completed'),
    );
    _events.on('failed', ({ jobId, failedReason }) =>
      logger.warn({ jobId, failedReason }, 'Reminders/alerts tick failed'),
    );
  }
  return _queue;
};

export const ensureRemindersSchedule = async () => {
  const queue = getRemindersQueue();
  await queue.upsertJobScheduler(
    SCHEDULER_ID,
    { pattern: DAILY_TICK_CRON, tz: 'UTC' },
    { name: 'daily', data: {}, opts: { removeOnComplete: { age: 3600 * 24 * 7 } } },
  );
  logger.info({ cron: DAILY_TICK_CRON, tz: 'UTC' }, 'Reminders/alerts scheduler ensured');
};

export const enqueueRemindersTickNow = async () => {
  await getRemindersQueue().add('manual', { scheduledFor: new Date().toISOString() });
};
