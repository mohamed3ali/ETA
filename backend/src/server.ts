import 'reflect-metadata';
import { createApp } from './app';
import { AppDataSource } from './database/data-source';
import { ensureSchemaPatches } from './database/ensure-schema';
import { env } from './config/env';
import { logger } from './config/logger';
import { startInvoiceWorker } from './workers/invoice.worker';
import { startSyncWorker } from './workers/sync.worker';
import { startWhatsappWorker } from './workers/whatsapp.worker';
import { startRecurringWorker } from './workers/recurring.worker';
import { startRemindersWorker } from './workers/reminders.worker';

const ROLE = process.env.ROLE ?? 'api';

const bootstrap = async () => {
  await AppDataSource.initialize();
  if (!env.DB_SYNCHRONIZE) {
    await ensureSchemaPatches(AppDataSource);
  }
  logger.info('Database connected');

  // Allow running workers in-process for dev convenience (single-container mode).
  // In production, the `worker` container runs `node dist/worker.js` separately.
  if (ROLE === 'api+worker' || env.NODE_ENV === 'development') {
    startInvoiceWorker();
    startSyncWorker();
    startWhatsappWorker();
    startRecurringWorker();
    startRemindersWorker();
    logger.info('Workers started in-process (development mode)');
  }

  const app = createApp();
  const server = app.listen(env.API_PORT, () => {
    logger.info(`API listening on :${env.API_PORT}${env.API_PREFIX}`);
    logger.info(`Swagger UI:    :${env.API_PORT}${env.API_PREFIX}/docs`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start API');
  process.exit(1);
});
