const { execFileSync } = require('node:child_process');
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

const schemaPath = 'prisma/schema.prisma';

function runPrisma(args) {
  execFileSync('npx', ['prisma', ...args, `--schema=${schemaPath}`], {
    cwd: __dirname,
    env: process.env,
    stdio: 'inherit',
  });
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
    if (migrationTableExists) {
      const count = await client.query('SELECT COUNT(*)::int AS count FROM "_prisma_migrations"');
      migrationCount = Number(count.rows[0]?.count || 0);
    }
    return { migrationTableExists, migrationCount, hasExistingTables: Boolean(result.rows[0]?.has_existing_tables) };
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

  console.log('Applying pending Prisma migrations.');
  runPrisma(['migrate', 'deploy']);
}

main().catch((error) => {
  // Avoid printing connection configuration or credentials from error objects.
  console.error(error instanceof Error ? error.message : 'Database migration bootstrap failed.');
  process.exitCode = 1;
});
