/**
 * Surgical recovery for TypeORM `synchronize` deadlocks.
 *
 * Run this script if the API logs:
 *   `Cannot drop index '...': needed in a foreign key constraint` (ER_DROP_INDEX_FK)
 *
 * What it does:
 *   1. For each FK column, finds whether MySQL InnoDB auto-created an index
 *      named after the FK constraint (e.g. `FK_<hash>(companyId)`) that is
 *      redundant once a covering compound `IDX_<hash>(companyId, ...)` index
 *      exists. Drops only those redundant FK-named indexes.
 *   2. Leaves user-declared compound indexes (`IDX_*`) untouched.
 *   3. Never re-runs TypeORM synchronize at the end — synchronize is the
 *      thing that creates the drift, so we let the caller flip DB_SYNCHRONIZE
 *      on/off manually if they really need it.
 *
 * Idempotent — running it on a clean schema is a no-op.
 */
import 'reflect-metadata';
import mysql, { Connection } from 'mysql2/promise';
import { env } from '../config/env';
import { logger } from '../config/logger';

interface DriftTarget {
  table: string;
  fkColumns: string[];
}

const TARGETS: DriftTarget[] = [
  { table: 'customers', fkColumns: ['companyId'] },
  { table: 'products', fkColumns: ['companyId'] },
  { table: 'invoices', fkColumns: ['companyId'] },
  { table: 'branches', fkColumns: ['companyId'] },
  { table: 'recurring_invoices', fkColumns: ['companyId'] },
];

const tableExists = async (conn: Connection, table: string): Promise<boolean> => {
  const [rows] = await conn.query<any[]>(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [env.MYSQL_DATABASE, table],
  );
  return Number(rows[0]?.n ?? 0) > 0;
};

interface IndexInfo {
  name: string;
  columns: string[];
}

const listIndexes = async (conn: Connection, table: string): Promise<IndexInfo[]> => {
  const [rows] = await conn.query<any[]>(
    `SELECT INDEX_NAME AS name, COLUMN_NAME AS col, SEQ_IN_INDEX AS pos
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
    [env.MYSQL_DATABASE, table],
  );
  const byName = new Map<string, string[]>();
  for (const r of rows) {
    const arr = byName.get(r.name) ?? [];
    arr.push(r.col as string);
    byName.set(r.name, arr);
  }
  return [...byName.entries()].map(([name, columns]) => ({ name, columns }));
};

const fixTable = async (conn: Connection, target: DriftTarget) => {
  if (!(await tableExists(conn, target.table))) {
    logger.info({ table: target.table }, 'Table not present — skipping');
    return;
  }

  const indexes = await listIndexes(conn, target.table);

  for (const col of target.fkColumns) {
    const coveringCompounds = indexes.filter(
      (i) =>
        i.name !== 'PRIMARY' &&
        i.columns[0] === col &&
        i.columns.length > 1 &&
        i.name.startsWith('IDX_'),
    );
    const fkNamedSingles = indexes.filter(
      (i) =>
        i.columns.length === 1 &&
        i.columns[0] === col &&
        i.name.startsWith('FK_'),
    );

    if (coveringCompounds.length === 0 || fkNamedSingles.length === 0) {
      continue;
    }

    for (const idx of fkNamedSingles) {
      try {
        await conn.query(`DROP INDEX \`${idx.name}\` ON \`${target.table}\``);
        logger.info(
          { table: target.table, idx: idx.name, coveredBy: coveringCompounds[0].name },
          'Dropped redundant FK-named index',
        );
      } catch (err) {
        logger.warn(
          { err, table: target.table, idx: idx.name },
          'Failed to drop redundant FK-named index (likely still held by FK; will require manual ALTER)',
        );
      }
    }
  }
};

const main = async () => {
  logger.info(
    { db: env.MYSQL_DATABASE, host: env.MYSQL_HOST },
    'Schema drift recovery starting (read-mostly)',
  );

  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    multipleStatements: true,
  });

  try {
    for (const target of TARGETS) {
      await fixTable(conn, target);
    }
  } finally {
    await conn.end();
  }

  logger.info(
    'Schema drift recovery complete. Keep DB_SYNCHRONIZE=false in .env and use migrations going forward.',
  );
};

main().catch((err) => {
  logger.fatal({ err }, 'Schema drift recovery failed');
  process.exit(1);
});
