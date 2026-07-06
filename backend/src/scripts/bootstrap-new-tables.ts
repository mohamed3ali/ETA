/**
 * Creates new tables added after initial schema bootstrap.
 * Safe to re-run (CREATE TABLE IF NOT EXISTS).
 *
 * Run: npx tsx src/scripts/bootstrap-new-tables.ts
 */
import 'reflect-metadata';
import mysql from 'mysql2/promise';
import { env } from '../config/env';

const ETA_PORTAL_DOCUMENTS_SQL = `
CREATE TABLE IF NOT EXISTS eta_portal_documents (
  id char(36) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at timestamp NULL DEFAULT NULL,
  companyId char(36) NOT NULL,
  uuid varchar(64) NOT NULL,
  direction enum('Sent','Received') NOT NULL DEFAULT 'Sent',
  submissionUUID varchar(64) NULL,
  longId varchar(64) NULL,
  internalId varchar(64) NULL,
  typeName varchar(16) NULL,
  typeVersionName varchar(16) NULL,
  issuerId varchar(60) NOT NULL,
  issuerName varchar(255) NOT NULL,
  issuerType varchar(8) NULL,
  receiverId varchar(60) NULL,
  receiverName varchar(255) NULL,
  receiverType varchar(8) NULL,
  dateTimeIssued datetime NOT NULL,
  dateTimeReceived datetime NULL,
  totalSales decimal(18,2) NOT NULL DEFAULT 0,
  totalDiscount decimal(18,2) NOT NULL DEFAULT 0,
  netAmount decimal(18,2) NOT NULL DEFAULT 0,
  total decimal(18,2) NOT NULL DEFAULT 0,
  status enum('Valid','Invalid','Rejected','Cancelled','Submitted') NOT NULL DEFAULT 'Valid',
  documentStatusReason varchar(500) NULL,
  publicUrl varchar(500) NULL,
  rawPayload json NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_company_uuid (companyId, uuid),
  KEY idx_portal_company_direction (companyId, direction),
  KEY idx_portal_company_issued (companyId, dateTimeIssued),
  CONSTRAINT fk_portal_doc_company FOREIGN KEY (companyId) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const main = async () => {
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
  });

  console.log('→ Ensuring `eta_portal_documents` table exists…');
  await conn.query(ETA_PORTAL_DOCUMENTS_SQL);
  console.log('  ✓ eta_portal_documents ready');

  await conn.end();
  console.log('Done.');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
