/**
 * Bootstraps the `company_memberships` table for an existing database.
 *
 *  1. Creates the table if it does not exist (idempotent — safe to re-run).
 *  2. Backfills one OWNER membership per existing user, marked as default,
 *     using their current `users.companyId`.
 *
 * Run with:  ts-node src/scripts/backfill-memberships.ts
 */
import 'reflect-metadata';
import mysql from 'mysql2/promise';
import { env } from '../config/env';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS company_memberships (
  id char(36) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at timestamp NULL DEFAULT NULL,
  userId char(36) NOT NULL,
  companyId char(36) NOT NULL,
  role enum('owner','admin','accountant','employee') NOT NULL DEFAULT 'accountant',
  isDefault tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_company (userId, companyId),
  KEY idx_membership_user (userId),
  KEY idx_membership_company (companyId),
  CONSTRAINT fk_membership_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_membership_company FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const main = async () => {
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    multipleStatements: false,
  });

  console.log('→ Ensuring `company_memberships` table exists…');
  await conn.query(CREATE_TABLE_SQL);
  console.log('  ✓ table ready');

  console.log('→ Backfilling memberships from existing users.companyId…');
  const [users] = await conn.query<any[]>(
    `SELECT u.id AS userId, u.companyId, u.role
     FROM users u
     WHERE u.companyId IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM company_memberships m
         WHERE m.userId = u.id AND m.companyId = u.companyId
       )`,
  );
  console.log(`  • ${users.length} user(s) need a membership row`);

  let inserted = 0;
  for (const u of users) {
    await conn.query(
      `INSERT INTO company_memberships
        (id, userId, companyId, role, isDefault, created_at, updated_at)
       VALUES (UUID(), ?, ?, ?, 1, NOW(), NOW())`,
      [u.userId, u.companyId, u.role ?? 'owner'],
    );
    inserted += 1;
  }
  console.log(`  ✓ inserted ${inserted} membership(s)`);

  await conn.end();
  console.log('Done.');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
