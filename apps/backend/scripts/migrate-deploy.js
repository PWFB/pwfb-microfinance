const { execFileSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { Client } = require('pg');

const LEGACY_MIGRATIONS = [
  '20260822160000_add_wallet_payout_state',
  '20260822190000_add_customer_virtual_accounts',
  '20260827090000_role_permissions',
  '20260914210000_staff_field_wallet_and_cashbook',
  '20260914220000_head_office_payroll_account',
  '20260915210000_add_audit_log',
  '20260916004400_add_branch_closing',
  '20260916010000_add_branch_closing_financial_locks',
];

// This specific additive migration is safe to retry: table/column/index creation
// is guarded, and the known failed attempt is resolved before retrying its FK statements.
const RETRYABLE_ADDITIVE_MIGRATION = '20261024120000_paystack_dva_staff_customer_assignment';
const schemaPath = 'prisma/schema.prisma';

function runPrisma(args) {
  try {
    const output = execFileSync('npx', ['prisma', ...args, `--schema=${schemaPath}`], {
      cwd: __dirname,
      env: process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (output) process.stdout.write(output);
  } catch (error) {
    if (error?.stdout) process.stdout.write(Buffer.isBuffer(error.stdout) ? error.stdout.toString('utf8') : error.stdout);
    if (error?.stderr) process.stderr.write(Buffer.isBuffer(error.stderr) ? error.stderr.toString('utf8') : error.stderr);
    throw error;
  }
}

async function deployMigrationsWithLockRetry() {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await deployMigrationsWithLockRetry();
      return;
    } catch (error) {
      const output = [error?.stderr, error?.stdout, error?.message]
        .map((value) => Buffer.isBuffer(value) ? value.toString('utf8') : String(value || ''))
        .join('\n');
      const lockTimeout = /P1002|advisory lock|Timed out trying to acquire/i.test(output);
      if (!lockTimeout || attempt === maxAttempts) throw error;
      const waitMs = attempt * 10000;
      console.warn(`Prisma migration lock is busy (attempt ${attempt}/${maxAttempts}); retrying in ${waitMs / 1000}s. No database data is being reset or deleted.`);
      await delay(waitMs);
    }
  }
}

async function inspectMigrationHistory() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required before applying database migrations.');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(`
      SELECT
        to_regclass('public._prisma_migrations') AS migration_table,
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            AND table_name <> '_prisma_migrations'
        ) AS has_existing_tables
    `);
    const migrationTableExists = Boolean(result.rows[0]?.migration_table);
    let migrationCount = 0;
    let retryableMigrationFailed = false;
    if (migrationTableExists) {
      const count = await client.query('SELECT COUNT(*)::int AS count FROM "_prisma_migrations"');
      migrationCount = Number(count.rows[0]?.count || 0);
      const failed = await client.query(
        'SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1 AND finished_at IS NULL AND rolled_back_at IS NULL LIMIT 1',
        [RETRYABLE_ADDITIVE_MIGRATION],
      );
      retryableMigrationFailed = failed.rowCount > 0;
    }
    return { migrationTableExists, migrationCount, hasExistingTables: Boolean(result.rows[0]?.has_existing_tables), retryableMigrationFailed };
  } finally {
    await client.end();
  }
}

async function main() {
  const state = await inspectMigrationHistory();

  // The existing Render database predates Prisma migration tracking. Baseline
  // only the eight legacy migrations when tables exist but history is absent.
  // This records history only; it does not alter or delete application data.
  const needsBaseline = state.hasExistingTables &&
    (!state.migrationTableExists || state.migrationCount === 0);

  if (needsBaseline) {
    console.log('Existing database detected without Prisma migration history; recording only the eight legacy migrations as applied. No application tables or rows will be dropped.');
    for (const migration of LEGACY_MIGRATIONS) {
      runPrisma(['migrate', 'resolve', '--applied', migration]);
    }
  }

  // Prisma blocks later migrations after a failed migration. Resolve only the
  // known, additive, idempotent migration above as rolled back, then retry it.
  // Never auto-resolve an unrelated failed migration.
  if (state.retryableMigrationFailed) {
    console.log(`Recovering failed additive migration ${RETRYABLE_ADDITIVE_MIGRATION} for a safe retry.`);
    runPrisma(['migrate', 'resolve', '--rolled-back', RETRYABLE_ADDITIVE_MIGRATION]);
  }

  console.log('Applying pending Prisma migrations.');
  runPrisma(['migrate', 'deploy']);
}

main().catch((error) => {
  // Avoid printing connection configuration or credentials from error objects.
  console.error(error instanceof Error ? error.message : 'Database migration bootstrap failed.');
  process.exitCode = 1;
});
