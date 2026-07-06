import { DataSource } from 'typeorm';
import { logger } from '../config/logger';

/**
 * Idempotent patches applied after AppDataSource.initialize() when
 * DB_SYNCHRONIZE=false. Keeps new tables/indexes in sync without running
 * full TypeORM synchronize (which deadlocks on customers.companyId indexes).
 */
export async function ensureSchemaPatches(ds: DataSource): Promise<void> {
  await ensureSubscriptionCheckouts(ds);
  await ensureTaxFilingTables(ds);
  await ensureCompanyInvites(ds);
  await relaxUsersEmailUniqueness(ds);
  await ensureProductKindColumn(ds);
}

async function ensureProductKindColumn(ds: DataSource): Promise<void> {
  const exists = await ds.query<Array<{ n: number }>>(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'products'
       AND COLUMN_NAME = 'kind'`,
  );
  if (Number(exists[0]?.n ?? 0) > 0) return;
  logger.info("Adding products.kind column (DB_SYNCHRONIZE=false)");
  await ds.query(
    `ALTER TABLE \`products\`
       ADD COLUMN \`kind\` ENUM('product','service') NOT NULL DEFAULT 'product' AFTER \`id\``,
  );
}

async function ensureSubscriptionCheckouts(ds: DataSource): Promise<void> {
  const rows = await ds.query<Array<{ n: number }>>(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_checkouts'`,
  );
  if (Number(rows[0]?.n ?? 0) > 0) return;

  logger.info('Creating subscription_checkouts table (DB_SYNCHRONIZE=false)');

  await ds.query(`
    CREATE TABLE \`subscription_checkouts\` (
      \`id\` char(36) NOT NULL,
      \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      \`deleted_at\` timestamp(6) NULL,
      \`companyId\` char(36) NOT NULL,
      \`createdById\` char(36) NULL,
      \`token\` varchar(64) NOT NULL,
      \`plan\` enum('trial','starter','professional','enterprise') NOT NULL,
      \`billingPeriod\` varchar(16) NOT NULL DEFAULT 'monthly',
      \`amount\` decimal(18,2) NOT NULL,
      \`currency\` varchar(10) NOT NULL DEFAULT 'EGP',
      \`status\` enum('pending','paid','cancelled','expired') NOT NULL DEFAULT 'pending',
      \`provider\` enum('paymob','mock') NOT NULL DEFAULT 'mock',
      \`providerRef\` varchar(255) NULL,
      \`checkoutUrl\` varchar(1000) NULL,
      \`paidAt\` timestamp NULL,
      \`expiresAt\` timestamp NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`IDX_subscription_checkouts_token\` (\`token\`),
      INDEX \`IDX_subscription_checkouts_company_status\` (\`companyId\`, \`status\`),
      CONSTRAINT \`FK_subscription_checkouts_company\`
        FOREIGN KEY (\`companyId\`) REFERENCES \`companies\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureCompanyInvites(ds: DataSource): Promise<void> {
  const rows = await ds.query<Array<{ n: number }>>(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_invites'`,
  );
  if (Number(rows[0]?.n ?? 0) > 0) return;

  logger.info('Creating company_invites table (DB_SYNCHRONIZE=false)');
  await ds.query(`
    CREATE TABLE \`company_invites\` (
      \`id\` char(36) NOT NULL,
      \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      \`deleted_at\` timestamp(6) NULL,
      \`companyId\` char(36) NOT NULL,
      \`email\` varchar(255) NOT NULL,
      \`role\` enum('owner','admin','accountant','employee') NOT NULL DEFAULT 'accountant',
      \`token\` varchar(64) NOT NULL,
      \`status\` enum('pending','accepted','revoked','expired') NOT NULL DEFAULT 'pending',
      \`invitedById\` char(36) NULL,
      \`expiresAt\` timestamp NULL,
      \`acceptedAt\` timestamp NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`idx_company_invite_token\` (\`token\`),
      INDEX \`uniq_company_invite_email\` (\`companyId\`, \`email\`, \`status\`),
      CONSTRAINT \`fk_company_invite_company\`
        FOREIGN KEY (\`companyId\`) REFERENCES \`companies\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_company_invite_invited_by\`
        FOREIGN KEY (\`invitedById\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/**
 * Historical schema enforced `UNIQUE (email, companyId)` on `users`, which
 * blocked the same email from being invited to a second company. The new
 * membership-driven model needs the email to be globally unique instead.
 *
 * Migration steps (idempotent):
 *   1. Drop the legacy compound unique index if present.
 *   2. Add a plain global UNIQUE on `email` (only if no duplicates exist).
 *      Duplicates are extremely unlikely in practice because the compound
 *      key meant each (email, companyId) was unique already and most users
 *      only belong to one company today. We log and skip if duplicates are
 *      present so the admin can resolve them manually.
 */
async function relaxUsersEmailUniqueness(ds: DataSource): Promise<void> {
  const existing = await ds.query<Array<{ INDEX_NAME: string }>>(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`,
  );
  const indexNames = new Set(existing.map((r) => r.INDEX_NAME));

  // Drop legacy compound unique on (email, companyId) if it still exists.
  for (const name of indexNames) {
    if (
      name &&
      name !== 'PRIMARY' &&
      name.toLowerCase().includes('email') &&
      name.toLowerCase().includes('company')
    ) {
      try {
        logger.info({ index: name }, 'Dropping legacy compound unique index on users');
        await ds.query(`ALTER TABLE \`users\` DROP INDEX \`${name}\``);
      } catch (err) {
        logger.warn({ err, index: name }, 'Failed to drop legacy users index');
      }
    }
  }

  // Add global unique on email if not already present.
  const hasGlobalEmail = await ds.query<Array<{ n: number }>>(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
       AND INDEX_NAME = 'uniq_users_email_global'`,
  );
  if (Number(hasGlobalEmail[0]?.n ?? 0) === 0) {
    const dupes = await ds.query<Array<{ email: string; n: number }>>(
      `SELECT LOWER(email) AS email, COUNT(*) AS n FROM users GROUP BY LOWER(email) HAVING n > 1`,
    );
    if (dupes.length > 0) {
      logger.warn(
        { duplicates: dupes.map((d) => d.email) },
        'Cannot enforce global unique on users.email — duplicates exist. Resolve manually.',
      );
      return;
    }
    try {
      await ds.query(
        `ALTER TABLE \`users\` ADD UNIQUE INDEX \`uniq_users_email_global\` (\`email\`)`,
      );
      logger.info('Added global unique index on users.email');
    } catch (err) {
      logger.warn({ err }, 'Could not add global unique on users.email');
    }
  }
}

async function ensureTaxFilingTables(ds: DataSource): Promise<void> {
  const rows = await ds.query<Array<{ n: number }>>(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vat_returns'`,
  );
  if (Number(rows[0]?.n ?? 0) > 0) return;

  logger.info('Creating tax filing tables (DB_SYNCHRONIZE=false)');
  const { TaxFilingTables1738000000000 } = await import('./migrations/1738000000000-TaxFilingTables');
  const migration = new TaxFilingTables1738000000000();
  const runner = ds.createQueryRunner();
  await runner.connect();
  try {
    await migration.up(runner);
  } finally {
    await runner.release();
  }
}
