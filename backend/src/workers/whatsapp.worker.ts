import { Worker } from 'bullmq';
import { redisOptions } from '../database/redis';
import { QUEUE_NAMES } from '../queues/queue-names';
import { WhatsappJob } from '../queues/whatsapp.queue';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { notificationService } from '../modules/notifications/notification.service';

const sendViaMeta = async (job: WhatsappJob): Promise<{ ok: true; mock?: boolean }> => {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    logger.warn(
      { to: job.to, template: job.template, body: job.body },
      'WhatsApp not configured — running in mock mode',
    );
    return { ok: true, mock: true };
  }
  const res = await fetch(
    `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: job.to,
        type: 'template',
        template: {
          name: job.template,
          language: { code: 'ar' },
          components: [
            {
              type: 'body',
              parameters: Object.values(job.variables).map((text) => ({
                type: 'text',
                text,
              })),
            },
          ],
        },
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WhatsApp send failed: ${res.status} ${text}`);
  }
  await res.json().catch(() => undefined);
  return { ok: true };
};

export const startWhatsappWorker = () => {
  const worker = new Worker<WhatsappJob>(
    QUEUE_NAMES.WHATSAPP_SEND,
    async (job) => {
      logger.info(
        { template: job.data.template, to: job.data.to, messageId: job.data.messageId },
        'Sending WhatsApp',
      );
      try {
        const result = await sendViaMeta(job.data);
        await notificationService.markMessageOutcome(job.data.messageId, {
          ok: true,
          mock: !!result.mock,
        });
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await notificationService.markMessageOutcome(job.data.messageId, {
          ok: false,
          error: msg,
        });
        throw err;
      }
    },
    { connection: redisOptions, concurrency: 3 },
  );

  worker.on('failed', (job, err) =>
    logger.warn({ jobId: job?.id, err: err.message }, 'whatsapp worker failed'),
  );
  return worker;
};
