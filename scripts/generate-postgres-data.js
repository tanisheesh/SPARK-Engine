// Generates a wide (100+ column), multi-GB "Insurance Policy & Claims Ledger"
// table directly inside a real PostgreSQL server. Run this yourself against
// your own reachable instance (including Supabase's Postgres connection string).
//
// Just run:  node scripts/generate-postgres-data.js
// It only prompts for the password (masked input); host/port/user/database use
// sane local defaults (127.0.0.1:5432, user "postgres", database "spark_test").
// Override any of them with env vars if needed: PG_HOST, PG_PORT, PG_USER,
// PG_PASSWORD, PG_DATABASE, PG_SSL ("true" for Supabase/managed Postgres),
// TARGET_GB (default 2.5).
//
// Requires: npm install pg

const { Client } = require('pg');

function askHidden(query) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(query);
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (char) => {
      const code = char.charCodeAt(0);
      if (char === '\n' || char === '\r' || code === 4) {
        if (stdin.isTTY) stdin.setRawMode(wasRaw);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value);
      } else if (code === 3) {
        process.stdout.write('\n');
        process.exit(1);
      } else if (code === 127 || code === 8) {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    stdin.on('data', onData);
  });
}

async function getConnectionConfig() {
  const host = process.env.PG_HOST || '127.0.0.1';
  const port = Number(process.env.PG_PORT || 5432);
  const user = process.env.PG_USER || 'postgres';
  const database = process.env.PG_DATABASE || 'spark_test';
  const ssl = process.env.PG_SSL === 'true';
  const password = process.env.PG_PASSWORD !== undefined ? process.env.PG_PASSWORD : await askHidden('PG password: ');
  return { host, port, user, password, database, ssl };
}

const TARGET_BYTES = Number(process.env.TARGET_GB || 2.5) * 1024 ** 3;
// Postgres caps bind params per query at 65535; COLUMNS.length is ~110, so keep
// BATCH_SIZE * COLUMNS.length comfortably under that.
const BATCH_SIZE = 500;
const CHECK_EVERY_BATCHES = 25;

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(99);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => Math.floor(min + rand() * (max - min + 1));
const dec = (min, max, places = 2) => Number((min + rand() * (max - min)).toFixed(places));
const bool = (p = 0.5) => rand() < p;
const pad = (n, len) => String(n).padStart(len, '0');
function isoDate(yFrom, yTo) {
  return `${int(yFrom, yTo)}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`;
}

const CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Pune', 'Hyderabad', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Lucknow'];
const FIRST = ['Ravi', 'Sunita', 'Arjun', 'Meera', 'Vikram', 'Neha', 'Karan', 'Pooja', 'Rohit', 'Anjali'];
const LAST = ['Agarwal', 'Bhatt', 'Chatterjee', 'Desai', 'Joshi', 'Kapoor', 'Menon', 'Rana', 'Iyer', 'Malhotra'];
const POLICY_TYPES = ['Health', 'Motor', 'Life', 'Home', 'Travel', 'Fire', 'Marine', 'Cyber'];
const INSURERS = ['Star Health', 'HDFC Ergo', 'ICICI Lombard', 'Max Bupa', 'Bajaj Allianz', 'Tata AIG', 'New India Assurance', 'SBI General'];

const COLUMNS = [
  { name: 'policy_id', type: 'VARCHAR(20)', gen: (i) => `POL${pad(i + 1, 12)}` },
  { name: 'policy_number', type: 'VARCHAR(20)', gen: () => `PN-${int(100000, 999999)}-${int(10, 99)}` },
  { name: 'policyholder_name', type: 'VARCHAR(60)', gen: () => `${pick(FIRST)} ${pick(LAST)}` },
  { name: 'policyholder_age', type: 'INT', gen: () => int(18, 85) },
  { name: 'policyholder_gender', type: 'VARCHAR(10)', gen: () => pick(['Male', 'Female', 'Other']) },
  { name: 'policyholder_city', type: 'VARCHAR(30)', gen: () => pick(CITIES) },
  { name: 'policyholder_occupation', type: 'VARCHAR(40)', gen: () => pick(['Salaried', 'Self-Employed', 'Business Owner', 'Retired', 'Student', 'Homemaker']) },
  { name: 'annual_income', type: 'NUMERIC(12,2)', gen: () => dec(200000, 5000000) },
  { name: 'policy_type', type: 'VARCHAR(20)', gen: () => pick(POLICY_TYPES) },
  { name: 'insurer', type: 'VARCHAR(40)', gen: () => pick(INSURERS) },
  { name: 'plan_name', type: 'VARCHAR(40)', gen: () => `${pick(['Elite', 'Prime', 'Secure', 'Advantage', 'Complete', 'Basic'])} ${pick(['Plan', 'Cover', 'Shield'])}` },
  { name: 'sum_insured', type: 'NUMERIC(12,2)', gen: () => pick([300000, 500000, 1000000, 2500000, 5000000, 10000000]) },
  { name: 'premium_amount', type: 'NUMERIC(10,2)', gen: () => dec(3000, 250000) },
  { name: 'premium_frequency', type: 'VARCHAR(15)', gen: () => pick(['Monthly', 'Quarterly', 'Half-Yearly', 'Annual']) },
  { name: 'policy_start_date', type: 'DATE', gen: () => isoDate(2015, 2026) },
  { name: 'policy_end_date', type: 'DATE', gen: () => isoDate(2020, 2032) },
  { name: 'policy_status', type: 'VARCHAR(20)', gen: () => pick(['Active', 'Lapsed', 'Expired', 'Cancelled', 'Renewed']) },
  { name: 'renewal_count', type: 'INT', gen: () => int(0, 15) },
  { name: 'nominee_name', type: 'VARCHAR(60)', gen: () => `${pick(FIRST)} ${pick(LAST)}` },
  { name: 'nominee_relationship', type: 'VARCHAR(20)', gen: () => pick(['Spouse', 'Child', 'Parent', 'Sibling', 'Other']) },
  { name: 'agent_id', type: 'VARCHAR(15)', gen: () => `AGT${pad(int(1, 8000), 6)}` },
  { name: 'agent_commission_pct', type: 'NUMERIC(5,2)', gen: () => dec(2, 20, 2) },
  { name: 'sales_channel', type: 'VARCHAR(20)', gen: () => pick(['Agent', 'Bancassurance', 'Online', 'Broker', 'Direct']) },
  { name: 'medical_checkup_done', type: 'BOOLEAN', gen: () => bool(0.4) },
  { name: 'pre_existing_condition', type: 'BOOLEAN', gen: () => bool(0.15) },
  { name: 'smoker_status', type: 'VARCHAR(15)', gen: () => pick(['Non-Smoker', 'Smoker', 'Former Smoker']) },
  { name: 'bmi', type: 'NUMERIC(5,2)', gen: () => dec(16, 42, 1) },
  { name: 'claim_id', type: 'VARCHAR(20)', gen: () => (bool(0.35) ? `CLM${pad(int(1, 900000), 8)}` : '') },
  { name: 'claim_date', type: 'DATE', gen: () => (bool(0.35) ? isoDate(2019, 2026) : null) },
  { name: 'claim_type', type: 'VARCHAR(30)', gen: () => pick(['Hospitalization', 'Accident', 'Death Benefit', 'Theft', 'Natural Disaster', 'Third Party Damage', 'Cashless']) },
  { name: 'claim_amount_requested', type: 'NUMERIC(12,2)', gen: () => (bool(0.35) ? dec(5000, 3000000) : 0) },
  { name: 'claim_amount_approved', type: 'NUMERIC(12,2)', gen: () => (bool(0.3) ? dec(5000, 2800000) : 0) },
  { name: 'claim_status', type: 'VARCHAR(20)', gen: () => pick(['Approved', 'Rejected', 'Under Review', 'Settled', 'Pending Documents']) },
  { name: 'claim_rejection_reason', type: 'VARCHAR(50)', gen: () => (bool(0.1) ? pick(['Policy Lapsed', 'Exclusion Clause', 'Fraud Suspected', 'Insufficient Documentation', 'Pre-existing Condition']) : '') },
  { name: 'hospital_name', type: 'VARCHAR(60)', gen: () => (bool(0.25) ? `${pick(CITIES)} ${pick(['General Hospital', 'Medical Center', 'Multispecialty Hospital', 'Care Hospital'])}` : '') },
  { name: 'treatment_type', type: 'VARCHAR(40)', gen: () => (bool(0.25) ? pick(['Surgery', 'ICU Admission', 'Outpatient', 'Diagnostic Tests', 'Physiotherapy']) : '') },
  { name: 'hospitalization_days', type: 'INT', gen: () => (bool(0.2) ? int(1, 30) : 0) },
  { name: 'is_cashless_claim', type: 'BOOLEAN', gen: () => bool(0.3) },
  { name: 'tpa_name', type: 'VARCHAR(40)', gen: () => pick(['MediAssist', 'Paramount TPA', 'Vidal Health', 'Health India TPA', 'Family Health Plan']) },
  { name: 'fraud_score', type: 'NUMERIC(5,2)', gen: () => dec(0, 100, 2) },
  { name: 'fraud_flag', type: 'BOOLEAN', gen: () => bool(0.02) },
  { name: 'investigation_required', type: 'BOOLEAN', gen: () => bool(0.05) },
  { name: 'settlement_days_taken', type: 'INT', gen: () => (bool(0.3) ? int(3, 90) : 0) },
  { name: 'discount_applied_pct', type: 'NUMERIC(5,2)', gen: () => dec(0, 25, 1) },
  { name: 'gst_amount', type: 'NUMERIC(10,2)', gen: () => dec(100, 45000) },
  { name: 'grace_period_days', type: 'INT', gen: () => pick([15, 30, 45]) },
  { name: 'auto_renewal_enabled', type: 'BOOLEAN', gen: () => bool(0.6) },
  { name: 'rider_addons', type: 'VARCHAR(60)', gen: () => (bool(0.4) ? pick(['Critical Illness', 'Accidental Death', 'Personal Loan Cover', 'Maternity', 'OPD Cover']) : 'None') },
  { name: 'customer_satisfaction_score', type: 'NUMERIC(4,2)', gen: () => dec(1, 10, 1) },
  { name: 'last_communication_date', type: 'DATE', gen: () => isoDate(2023, 2026) },
];
for (let m = 1; m <= 60; m++) COLUMNS.push({ name: `underwriting_factor_${pad(m, 2)}`, type: 'NUMERIC(12,4)', gen: () => dec(-1000, 1000, 4) });

function sanitizeId(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}

async function ensureDatabaseExists(config) {
  const admin = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres',
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  });
  await admin.connect();
  const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.database]);
  if (rows.length === 0) {
    console.log(`Database "${config.database}" does not exist, creating it...`);
    await admin.query(`CREATE DATABASE "${sanitizeId(config.database)}"`);
  }
  await admin.end();
}

async function main() {
  const config = await getConnectionConfig();
  await ensureDatabaseExists(config);

  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  const table = 'insurance_policy_claims';
  console.log(`Connected. Creating table "${table}" with ${COLUMNS.length} columns...`);

  await client.query(`DROP TABLE IF EXISTS "${table}"`);
  const colDefs = COLUMNS.map((c) => `"${sanitizeId(c.name)}" ${c.type}`).join(', ');
  await client.query(`CREATE TABLE "${table}" (${colDefs})`);

  const colNames = COLUMNS.map((c) => `"${sanitizeId(c.name)}"`).join(', ');

  let inserted = 0;
  let batchNum = 0;
  const t0 = Date.now();

  while (true) {
    const values = [];
    const params = [];
    let p = 1;
    for (let r = 0; r < BATCH_SIZE; r++) {
      const i = inserted + r;
      const placeholders = [];
      for (const col of COLUMNS) {
        const v = col.gen(i);
        params.push(v === null || v === undefined ? null : v);
        placeholders.push(`$${p++}`);
      }
      values.push(`(${placeholders.join(', ')})`);
    }
    await client.query(`INSERT INTO "${table}" (${colNames}) VALUES ${values.join(', ')}`, params);
    inserted += BATCH_SIZE;
    batchNum++;

    if (batchNum % CHECK_EVERY_BATCHES === 0) {
      const { rows } = await client.query(`SELECT pg_total_relation_size($1) AS bytes`, [table]);
      const bytes = Number(rows[0].bytes || 0);
      const gb = bytes / 1024 ** 3;
      const elapsed = (Date.now() - t0) / 1000;
      console.log(`  ${inserted.toLocaleString()} rows, ${gb.toFixed(2)}GB, ${elapsed.toFixed(0)}s elapsed`);
      if (bytes >= TARGET_BYTES) break;
    }
  }

  console.log(`\nDone: ${inserted.toLocaleString()} rows in table "${table}", target ${(TARGET_BYTES / 1024 ** 3).toFixed(1)}GB reached.`);
  await client.end();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
