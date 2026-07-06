import { Worker } from 'bullmq';
import { redisOptions } from '../database/redis';
import { QUEUE_NAMES } from '../queues/queue-names';
import {
  RemindersTickJob,
  ensureRemindersSchedule,
} from '../queues/reminders.queue';
import { reminderService } from '../modules/notifications/reminder.service';
import { alertService } from '../modules/alerts/alert.service';
import { quotaService } from '../modules/subscriptions/quota.service';
import { logger } from '../config/logger';

export const startRemindersWorker = () => {
  const worker = new Worker<RemindersTickJob>(
    QUEUE_NAMES.REMINDERS_TICK,
    async (job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Daily reminders/alerts tick');
      const [reminders, alerts, subs] = await Promise.all([
        reminderService.runAll(),
        alertService.evaluateAll(),
        quotaService.expireOverdueSubscriptions(),
      ]);
      const queued = reminders.reduce((s, r) => s + r.queued, 0);
      const touched = alerts.reduce((s, r) => s + r.touched, 0);
      logger.info({ queued, touched, expiredSubs: subs.expired }, 'Tick complete');
      return { queued, touched, expiredSubs: subs.expired };
    },
    { connection: redisOptions, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Reminders/alerts worker failed');
  });

  ensureRemindersSchedule().catch((err) =>
    logger.error({ err }, 'Failed to register reminders schedule'),
  );

  return worker;
};
