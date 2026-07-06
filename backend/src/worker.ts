import 'reflect-metadata';
import { AppDataSource } from './database/data-source';
import { ensureSchemaPatches } from './database/ensure-schema';
import { env } from './config/env';
import { logger } from './config/logger';
import { startInvoiceWorker } from './workers/invoice.worker';
import { startSyncWorker } from './workers/sync.worker';
import { startWhatsappWorker } from './workers/whatsapp.worker';
import { startRecurringWorker } from './workers/recurring.worker';
import { startRemindersWorker } from './workers/reminders.worker';

const bootstrap = async () => {
  await AppDataSource.initialize();
  if (!env.DB_SYNCHRONIZE) {
    await ensureSchemaPatches(AppDataSource);
  }
  logger.info('Database connected (worker)');

  startInvoiceWorker();
  startSyncWorker();
  startWhatsappWorker();
  startRecurringWorker();
  startRemindersWorker();

  logger.info('All BullMQ workers started');
};

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Worker failed to bootstrap');
  process.exit(1);
});

const shutdown = async () => {
  logger.info('Worker shutdown signal received');
  await AppDataSource.destroy().catch(() => undefined);
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
