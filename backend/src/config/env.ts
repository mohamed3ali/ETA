import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  MYSQL_HOST: z.string().default('localhost'),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_DATABASE: z.string().default('eta_saas'),
  MYSQL_USER: z.string().default('root'),
  MYSQL_PASSWORD: z.string().default(''),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  API_PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default('/api'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.string().default('info'),

  JWT_SECRET: z.string().min(8, 'JWT_SECRET is required'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(8, 'JWT_REFRESH_SECRET is required'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().default(10),

  ETA_BASE_URL: z.string().default('https://api.preprod.invoicing.eta.gov.eg'),
  ETA_ID_BASE_URL: z.string().default('https://id.preprod.eta.gov.eg'),
  ETA_CLIENT_ID: z.string().optional().default(''),
  ETA_CLIENT_SECRET: z.string().optional().default(''),
  ETA_ENVIRONMENT: z.enum(['preprod', 'production']).default('preprod'),

  WHATSAPP_PROVIDER: z.string().default('meta'),
  WHATSAPP_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),

  // Payment gateway — Paymob (mock-by-default when keys are empty)
  PAYMOB_BASE_URL: z.string().default('https://accept.paymob.com/api'),
  PAYMOB_CHECKOUT_URL: z.string().default('https://accept.paymob.com/unifiedcheckout/'),
  PAYMOB_API_KEY: z.string().optional().default(''),
  PAYMOB_PUBLIC_KEY: z.string().optional().default(''),
  PAYMOB_INTEGRATION_ID: z.string().optional().default(''),
  PAYMOB_HMAC_SECRET: z.string().optional().default(''),

  // Public URLs used when generating customer-facing payment links + webhooks
  PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
  PUBLIC_API_URL: z.string().default('http://localhost:4000/api'),

  OPENAI_API_KEY: z.string().optional().default(''),

  // Optional launch promo applied to every paid plan's price (0–90).
  // Example: LAUNCH_DISCOUNT_PERCENT=10 turns 6,990 yearly into 6,291.
  LAUNCH_DISCOUNT_PERCENT: z.coerce.number().min(0).max(90).default(0),

  // TypeORM schema sync. Default false because synchronize can deadlock when
  // an entity has a compound @Index whose leading column is a FK
  // (regenerates an "orphan" auto-FK-index that MySQL won't let it drop —
  // ER_DROP_INDEX_FK). Set DB_SYNCHRONIZE=true only for the first boot of a
  // fresh DB; afterwards keep it false and use migrations / db:fix.
  DB_SYNCHRONIZE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
