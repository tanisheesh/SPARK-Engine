// Generates a wide (100+ column), multi-GB "Airline Flight Bookings & Passenger
// Records" table directly inside a real MySQL server. Run this yourself against
// your own reachable instance.
//
// Just run:  node scripts/generate-mysql-data.js
// It only prompts for the password (masked input); host/port/user/database use
// sane local defaults (127.0.0.1:3306, user "root", database "spark_test").
// Override any of them with env vars if needed: MYSQL_HOST, MYSQL_PORT,
// MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, TARGET_GB (default 2.5).
//
// Requires: npm install mysql2

const mysql = require('mysql2/promise');

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
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT || 3306);
  const user = process.env.MYSQL_USER || 'root';
  const database = process.env.MYSQL_DATABASE || 'spark_test';
  const password = process.env.MYSQL_PASSWORD !== undefined ? process.env.MYSQL_PASSWORD : await askHidden('MySQL password: ');
  return { host, port, user, password, database };
}

const TARGET_BYTES = Number(process.env.TARGET_GB || 2.5) * 1024 ** 3;
const BATCH_SIZE = 2000;
const CHECK_EVERY_BATCHES = 25; // query information_schema this often

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
const rand = mulberry32(42);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => Math.floor(min + rand() * (max - min + 1));
const dec = (min, max, places = 2) => Number((min + rand() * (max - min)).toFixed(places));
const bool = (p = 0.5) => rand() < p;
const pad = (n, len) => String(n).padStart(len, '0');
function isoDate(yFrom, yTo) {
  return `${int(yFrom, yTo)}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`;
}
function isoDateTime(yFrom, yTo) {
  return `${isoDate(yFrom, yTo)}T${pad(int(0, 23), 2)}:${pad(int(0, 59), 2)}:${pad(int(0, 59), 2)}`;
}

const AIRPORTS = ['DEL', 'BOM', 'BLR', 'MAA', 'HYD', 'CCU', 'PNQ', 'AMD', 'JFK', 'LHR', 'DXB', 'SIN', 'HKG', 'FRA', 'CDG'];
const AIRLINES = ['IndiGo', 'Air India', 'Vistara', 'SpiceJet', 'AirAsia India', 'Emirates', 'Qatar Airways', 'Lufthansa', 'British Airways'];
const AIRCRAFT = ['Airbus A320neo', 'Boeing 737 MAX', 'Airbus A321', 'Boeing 777', 'Airbus A350', 'Boeing 787 Dreamliner', 'ATR 72'];
const FIRST = ['Aarav', 'Vivaan', 'Priya', 'Ananya', 'Kavya', 'James', 'Olivia', 'Liam', 'Emma', 'Noah', 'Sophia', 'Ethan'];
const LAST = ['Sharma', 'Verma', 'Gupta', 'Reddy', 'Nair', 'Smith', 'Johnson', 'Brown', 'Patel', 'Singh', 'Kumar', 'Das'];

const COLUMNS = [
  { name: 'booking_id', type: 'VARCHAR(20)', gen: (i) => `BKG${pad(i + 1, 12)}` },
  { name: 'pnr', type: 'VARCHAR(10)', gen: () => Array.from({ length: 6 }, () => pick('ABCDEFGHJKLMNPQRSTUVWXYZ'.split(''))).join('') },
  { name: 'flight_number', type: 'VARCHAR(10)', gen: () => `${pick(['6E', 'AI', 'UK', 'SG', 'I5', 'EK', 'QR', 'LH', 'BA'])}${int(100, 9999)}` },
  { name: 'airline', type: 'VARCHAR(40)', gen: () => pick(AIRLINES) },
  { name: 'aircraft_type', type: 'VARCHAR(40)', gen: () => pick(AIRCRAFT) },
  { name: 'origin_airport', type: 'VARCHAR(5)', gen: () => pick(AIRPORTS) },
  { name: 'destination_airport', type: 'VARCHAR(5)', gen: () => pick(AIRPORTS) },
  { name: 'departure_datetime', type: 'VARCHAR(20)', gen: () => isoDateTime(2019, 2026) },
  { name: 'arrival_datetime', type: 'VARCHAR(20)', gen: () => isoDateTime(2019, 2026) },
  { name: 'booking_date', type: 'VARCHAR(10)', gen: () => isoDate(2019, 2026) },
  { name: 'passenger_id', type: 'VARCHAR(20)', gen: () => `PAX${pad(int(1, 900000), 8)}` },
  { name: 'passenger_first_name', type: 'VARCHAR(40)', gen: () => pick(FIRST) },
  { name: 'passenger_last_name', type: 'VARCHAR(40)', gen: () => pick(LAST) },
  { name: 'passenger_age', type: 'INT', gen: () => int(1, 90) },
  { name: 'passenger_gender', type: 'VARCHAR(10)', gen: () => pick(['Male', 'Female', 'Other']) },
  { name: 'nationality', type: 'VARCHAR(30)', gen: () => pick(['India', 'United States', 'United Kingdom', 'UAE', 'Singapore', 'Germany', 'France']) },
  { name: 'passport_number', type: 'VARCHAR(15)', gen: () => `${pick('ABCDEFGHJ'.split(''))}${int(1000000, 9999999)}` },
  { name: 'seat_number', type: 'VARCHAR(5)', gen: () => `${int(1, 45)}${pick(['A', 'B', 'C', 'D', 'E', 'F'])}` },
  { name: 'cabin_class', type: 'VARCHAR(20)', gen: () => pick(['Economy', 'Premium Economy', 'Business', 'First']) },
  { name: 'fare_type', type: 'VARCHAR(20)', gen: () => pick(['Saver', 'Flexi', 'Corporate', 'Student']) },
  { name: 'base_fare', type: 'DECIMAL(10,2)', gen: () => dec(1500, 150000) },
  { name: 'taxes_and_fees', type: 'DECIMAL(10,2)', gen: () => dec(200, 15000) },
  { name: 'total_fare', type: 'DECIMAL(10,2)', gen: () => dec(2000, 165000) },
  { name: 'currency', type: 'VARCHAR(5)', gen: () => pick(['INR', 'USD', 'GBP', 'EUR', 'AED']) },
  { name: 'payment_method', type: 'VARCHAR(20)', gen: () => pick(['Credit Card', 'Debit Card', 'Net Banking', 'UPI', 'Wallet', 'Points']) },
  { name: 'payment_status', type: 'VARCHAR(20)', gen: () => pick(['Paid', 'Pending', 'Refunded', 'Failed']) },
  { name: 'booking_channel', type: 'VARCHAR(20)', gen: () => pick(['Website', 'Mobile App', 'Travel Agent', 'Airport Counter', 'OTA']) },
  { name: 'booking_status', type: 'VARCHAR(20)', gen: () => pick(['Confirmed', 'Waitlisted', 'Cancelled', 'Checked-In', 'No-Show']) },
  { name: 'loyalty_program', type: 'VARCHAR(30)', gen: () => pick(['None', 'Silver', 'Gold', 'Platinum', 'Diamond']) },
  { name: 'loyalty_points_earned', type: 'INT', gen: () => int(0, 5000) },
  { name: 'loyalty_points_redeemed', type: 'INT', gen: () => (bool(0.2) ? int(0, 20000) : 0) },
  { name: 'baggage_checked_count', type: 'INT', gen: () => int(0, 3) },
  { name: 'baggage_weight_kg', type: 'DECIMAL(5,2)', gen: () => dec(0, 32) },
  { name: 'excess_baggage_fee', type: 'DECIMAL(8,2)', gen: () => (bool(0.15) ? dec(500, 8000) : 0) },
  { name: 'meal_preference', type: 'VARCHAR(20)', gen: () => pick(['Standard', 'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-Free']) },
  { name: 'special_assistance', type: 'VARCHAR(30)', gen: () => (bool(0.05) ? pick(['Wheelchair', 'Visual Impairment', 'Hearing Impairment', 'Medical']) : 'None') },
  { name: 'seat_selection_fee', type: 'DECIMAL(8,2)', gen: () => (bool(0.4) ? dec(200, 3000) : 0) },
  { name: 'travel_insurance', type: 'BOOLEAN', gen: () => bool(0.3) },
  { name: 'insurance_premium', type: 'DECIMAL(8,2)', gen: () => (bool(0.3) ? dec(100, 2000) : 0) },
  { name: 'check_in_status', type: 'VARCHAR(20)', gen: () => pick(['Online', 'Airport Counter', 'Kiosk', 'Not Checked In']) },
  { name: 'boarding_group', type: 'VARCHAR(5)', gen: () => pick(['A', 'B', 'C', 'D']) },
  { name: 'gate_number', type: 'VARCHAR(6)', gen: () => `G${int(1, 60)}` },
  { name: 'terminal', type: 'VARCHAR(5)', gen: () => pick(['T1', 'T2', 'T3']) },
  { name: 'flight_status', type: 'VARCHAR(20)', gen: () => pick(['On Time', 'Delayed', 'Cancelled', 'Diverted', 'Landed']) },
  { name: 'delay_minutes', type: 'INT', gen: () => (bool(0.2) ? int(5, 300) : 0) },
  { name: 'distance_km', type: 'INT', gen: () => int(200, 14000) },
  { name: 'duration_minutes', type: 'INT', gen: () => int(45, 1100) },
  { name: 'co2_emissions_kg', type: 'DECIMAL(8,2)', gen: () => dec(20, 3500) },
  { name: 'refund_amount', type: 'DECIMAL(10,2)', gen: () => (bool(0.05) ? dec(500, 50000) : 0) },
  { name: 'cancellation_reason', type: 'VARCHAR(40)', gen: () => (bool(0.05) ? pick(['Weather', 'Technical', 'Passenger Request', 'Operational']) : '') },
  { name: 'travel_agent_id', type: 'VARCHAR(15)', gen: () => (bool(0.2) ? `AGT${pad(int(1, 5000), 5)}` : '') },
  { name: 'corporate_account_id', type: 'VARCHAR(15)', gen: () => (bool(0.15) ? `CORP${pad(int(1, 2000), 5)}` : '') },
  { name: 'satisfaction_score', type: 'DECIMAL(4,2)', gen: () => dec(1, 10, 1) },
  { name: 'complaint_filed', type: 'BOOLEAN', gen: () => bool(0.03) },
];
for (let m = 1; m <= 60; m++) COLUMNS.push({ name: `sensor_metric_${pad(m, 2)}`, type: 'DECIMAL(12,4)', gen: () => dec(-1000, 1000, 4) });

function sanitizeId(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}

async function main() {
  const config = await getConnectionConfig();

  const admin = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: false,
  });
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${sanitizeId(config.database)}\``);
  await admin.end();

  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    multipleStatements: false,
  });

  const table = 'airline_flight_bookings';
  console.log(`Connected. Creating table "${table}" with ${COLUMNS.length} columns...`);

  await conn.query(`DROP TABLE IF EXISTS \`${table}\``);
  const colDefs = COLUMNS.map((c) => `\`${sanitizeId(c.name)}\` ${c.type}`).join(', ');
  await conn.query(`CREATE TABLE \`${table}\` (${colDefs}) ENGINE=InnoDB`);

  const colNames = COLUMNS.map((c) => `\`${sanitizeId(c.name)}\``).join(', ');
  const placeholdersOneRow = `(${COLUMNS.map(() => '?').join(', ')})`;

  let inserted = 0;
  let batchNum = 0;
  const t0 = Date.now();

  while (true) {
    const rows = [];
    const params = [];
    for (let r = 0; r < BATCH_SIZE; r++) {
      const i = inserted + r;
      const rowValues = COLUMNS.map((c) => {
        const v = c.gen(i);
        return typeof v === 'boolean' ? (v ? 1 : 0) : v;
      });
      rows.push(placeholdersOneRow);
      params.push(...rowValues);
    }
    await conn.query(`INSERT INTO \`${table}\` (${colNames}) VALUES ${rows.join(', ')}`, params);
    inserted += BATCH_SIZE;
    batchNum++;

    if (batchNum % CHECK_EVERY_BATCHES === 0) {
      const [[sizeRow]] = await conn.query(
        `SELECT (DATA_LENGTH + INDEX_LENGTH) AS bytes FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [config.database, table]
      );
      const bytes = Number(sizeRow.bytes || 0);
      const gb = bytes / 1024 ** 3;
      const elapsed = (Date.now() - t0) / 1000;
      console.log(`  ${inserted.toLocaleString()} rows, ${gb.toFixed(2)}GB, ${elapsed.toFixed(0)}s elapsed`);
      if (bytes >= TARGET_BYTES) break;
    }
  }

  console.log(`\nDone: ${inserted.toLocaleString()} rows in table "${table}", target ${(TARGET_BYTES / 1024 ** 3).toFixed(1)}GB reached.`);
  await conn.end();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
