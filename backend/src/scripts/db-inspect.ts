/**
 * Read-only inspector — prints every table, every foreign key, and every
 * non-PRIMARY index for the configured MySQL database. Useful for diagnosing
 * schema drift before deciding how to repair it.
 */
import 'reflect-metadata';
import mysql from 'mysql2/promise';
import { env } from '../config/env';

const main = async () => {
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
  });

  const [tables] = await conn.query<any[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
    [env.MYSQL_DATABASE],
  );
  console.log(`\n=== Database: ${env.MYSQL_DATABASE} ===`);
  console.log(`Tables (${tables.length}):`, tables.map((t) => t.TABLE_NAME).join(', '));

  const [fks] = await conn.query<any[]>(
    `SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY TABLE_NAME, CONSTRAINT_NAME`,
    [env.MYSQL_DATABASE],
  );
  console.log(`\n=== Foreign keys (${fks.length}): ===`);
  for (const fk of fks) {
    console.log(
      `  ${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}  [${fk.CONSTRAINT_NAME}]`,
    );
  }

  const [idx] = await conn.query<any[]>(
    `SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND INDEX_NAME != 'PRIMARY'
     ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
    [env.MYSQL_DATABASE],
  );
  console.log(`\n=== Non-PRIMARY indexes (${new Set(idx.map((i) => `${i.TABLE_NAME}.${i.INDEX_NAME}`)).size}): ===`);
  let curr = '';
  const cols: string[] = [];
  const flush = () => {
    if (curr) console.log(`  ${curr}: (${cols.join(', ')})`);
  };
  for (const i of idx) {
    const key = `${i.TABLE_NAME}.${i.INDEX_NAME}`;
    if (key !== curr) {
      flush();
      curr = key;
      cols.length = 0;
    }
    cols.push(i.COLUMN_NAME);
  }
  flush();

  await conn.end();
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
