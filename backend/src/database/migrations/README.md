# TypeORM Migrations

TypeORM migrations are the source of truth for the production schema.
`DB_SYNCHRONIZE` must stay `false` in production — `synchronize: true` can
deadlock on compound `@Index` columns that share a leading FK (see
`ensure-schema.ts` for the historical drift fix).

## Workflow

### 1. Generate a migration from your current entities

After you change any `*.entity.ts`, point TypeORM at a running database that
already reflects the previous state and let it diff:

```bash
# from backend/
npm run migration:generate -- src/database/migrations/AddSomeColumn
```

TypeORM writes a timestamped `.ts` file in this directory. Open it, sanity
check the SQL (especially `DROP COLUMN` / `RENAME` lines), commit it.

### 2. Run pending migrations

```bash
# locally (TypeScript runs via tsx)
npm run migration:run

# in production (compiled JS, executed in the api container)
docker compose exec api npm run migration:run
```

`migration:run` only executes migrations that have not been applied yet,
recorded in the `migrations` table.

### 3. Revert the most recent migration

```bash
npm run migration:revert
```

### 4. List status

```bash
npm run migration:show
```

## First-time setup on a fresh production database

1. Boot the stack once with `DB_SYNCHRONIZE=true` to let TypeORM create every
   table — or generate a baseline migration once and run it:

   ```bash
   # against an empty database
   npm run migration:generate -- src/database/migrations/InitialSchema
   npm run migration:run
   ```

2. Set `DB_SYNCHRONIZE=false` for all subsequent boots.

3. From now on every entity change ships with a paired migration file.

## Why not `synchronize: true` in production?

- It silently drops and recreates indexes — easy to lose data.
- It cannot reconcile some compound `@Index` + FK column patterns we use
  (see `companies.companyId` history), causing `ER_DROP_INDEX_FK`.
- It hides schema changes from code review.

The runtime `ensureSchemaPatches()` helper (in `../ensure-schema.ts`) is a
narrow safety net for one-off table additions only — prefer real migrations.
