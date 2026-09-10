// Generates 4 DIFFERENT wide (100+ column) datasets, one per standalone
// format THUNDER supports (CSV, JSON, XLSX, SQLite) — each its own topic,
// each targeting ~10GB (calibrated from a small sample first, with a
// 2.5GB floor if calibration runs short). Output goes to sample-data/,
// which is gitignored — never commit these.
//
// MySQL/PostgreSQL/Supabase need a real reachable server and aren't
// generated here.

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const ExcelJS = require('exceljs');

const TARGET_BYTES = 2.5 * 1024 ** 3; // ~2.5GB goal
const FLOOR_BYTES = 2.2 * 1024 ** 3; // never undershoot this
const CALIBRATION_ROWS = 8000;
const OUT_DIR = path.join(__dirname, '..', 'sample-data');

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
const pad = (n, len) => String(n).padStart(len, '0');

function makeHelpers(seed) {
  const rand = mulberry32(seed);
  return {
    rand,
    pick: (arr) => arr[Math.floor(rand() * arr.length)],
    int: (min, max) => Math.floor(min + rand() * (max - min + 1)),
    dec: (min, max, places = 2) => Number((min + rand() * (max - min)).toFixed(places)),
    bool: (pTrue = 0.5) => rand() < pTrue,
  };
}

function isoDate(int, yFrom, yTo) {
  return `${int(yFrom, yTo)}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`;
}
function isoDateTime(int, yFrom, yTo) {
  return `${isoDate(int, yFrom, yTo)}T${pad(int(0, 23), 2)}:${pad(int(0, 59), 2)}:${pad(int(0, 59), 2)}`;
}

/* ============================================================
   Topic 1 (CSV) — Global Retail Order Transactions
   ============================================================ */
function retailColumns(h) {
  const { pick, int, dec, bool } = h;
  const FIRST = ['Aarav', 'Vivaan', 'Priya', 'Ananya', 'Kavya', 'James', 'Olivia', 'Liam', 'Emma', 'Noah', 'Sophia', 'Ethan'];
  const LAST = ['Sharma', 'Verma', 'Gupta', 'Reddy', 'Nair', 'Smith', 'Johnson', 'Brown', 'Patel', 'Singh', 'Kumar', 'Das'];
  const CATEGORIES = ['Electronics', 'Apparel', 'Home & Kitchen', 'Sports', 'Books', 'Beauty', 'Toys', 'Automotive', 'Grocery', 'Office Supplies'];
  const BRANDS = ['Nova', 'Zenith', 'Everline', 'Pulse', 'Meridian', 'Craftwell', 'Solstice', 'Vertex'];
  const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Germany', 'Canada', 'Australia', 'Singapore', 'UAE'];
  const CITIES = ['Mumbai', 'Bengaluru', 'Delhi', 'Chennai', 'Pune', 'Hyderabad', 'New York', 'London', 'Toronto', 'Sydney'];
  const cols = [
    { name: 'transaction_id', gen: (i) => `TXN${pad(i + 1, 9)}` },
    { name: 'order_id', gen: (i) => `ORD${pad(int(1, 9999999), 8)}` },
    { name: 'customer_id', gen: () => `CUST${pad(int(1, 500000), 7)}` },
    { name: 'customer_name', gen: () => `${pick(FIRST)} ${pick(LAST)}` },
    { name: 'customer_email', gen: (i) => `customer${i + 1}@example.com` },
    { name: 'phone_number', gen: () => `+91-${int(6000000000, 9999999999)}` },
    { name: 'order_date', gen: () => isoDate(int, 2019, 2026) },
    { name: 'ship_date', gen: () => isoDate(int, 2019, 2026) },
    { name: 'delivery_date', gen: () => isoDate(int, 2019, 2026) },
    { name: 'product_id', gen: () => `PRD${pad(int(1, 8000), 6)}` },
    { name: 'product_category', gen: () => pick(CATEGORIES) },
    { name: 'brand', gen: () => pick(BRANDS) },
    { name: 'sku', gen: () => `SKU-${int(100000, 999999)}` },
    { name: 'quantity', gen: () => int(1, 12) },
    { name: 'unit_price', gen: () => dec(50, 50000) },
    { name: 'discount_pct', gen: () => dec(0, 40, 1) },
    { name: 'tax_pct', gen: () => pick([0, 5, 12, 18, 28]) },
    { name: 'shipping_cost', gen: () => dec(0, 500) },
    { name: 'currency', gen: () => pick(['INR', 'USD', 'GBP', 'EUR']) },
    { name: 'payment_method', gen: () => pick(['Credit Card', 'UPI', 'Net Banking', 'Wallet', 'Cash on Delivery']) },
    { name: 'payment_status', gen: () => pick(['Paid', 'Pending', 'Failed', 'Refunded']) },
    { name: 'order_status', gen: () => pick(['Placed', 'Shipped', 'Delivered', 'Cancelled', 'Returned']) },
    { name: 'customer_segment', gen: () => pick(['New', 'Regular', 'VIP', 'At Risk', 'Dormant']) },
    { name: 'customer_lifetime_value', gen: () => dec(500, 500000) },
    { name: 'is_returning_customer', gen: () => bool(0.55) },
    { name: 'loyalty_tier', gen: () => pick(['Bronze', 'Silver', 'Gold', 'Platinum']) },
    { name: 'region', gen: () => pick(['North', 'South', 'East', 'West', 'Central']) },
    { name: 'country', gen: () => pick(COUNTRIES) },
    { name: 'city', gen: () => pick(CITIES) },
    { name: 'postal_code', gen: () => String(int(100000, 999999)) },
    { name: 'sales_rep_id', gen: () => `REP${pad(int(1, 300), 4)}` },
    { name: 'channel', gen: () => pick(['Web', 'Mobile App', 'Marketplace', 'In-Store']) },
    { name: 'device_type', gen: () => pick(['Desktop', 'Mobile', 'Tablet']) },
    { name: 'campaign_id', gen: () => (bool(0.6) ? `CMP${pad(int(1, 200), 4)}` : '') },
    { name: 'coupon_code', gen: () => (bool(0.3) ? pick(['SAVE10', 'WELCOME20', 'FESTIVE15']) : '') },
    { name: 'shipping_method', gen: () => pick(['Standard', 'Express', 'Same Day', 'Economy']) },
    { name: 'carrier', gen: () => pick(['BlueDart', 'Delhivery', 'FedEx', 'DHL', 'UPS']) },
    { name: 'tracking_number', gen: () => `TRK${int(100000000, 999999999)}` },
    { name: 'return_flag', gen: () => bool(0.08) },
    { name: 'refund_amount', gen: () => (bool(0.08) ? dec(0, 20000) : 0) },
    { name: 'risk_score', gen: () => dec(0, 100, 1) },
    { name: 'priority_level', gen: () => pick(['Low', 'Normal', 'High', 'Urgent']) },
  ];
  for (let m = 1; m <= 68; m++) cols.push({ name: `metric_${pad(m, 2)}`, gen: () => dec(0, 1000, 3) });
  return cols;
}

/* ============================================================
   Topic 2 (JSON) — Industrial IoT Sensor Telemetry
   ============================================================ */
function iotColumns(h) {
  const { pick, int, dec, bool } = h;
  const PLANTS = ['Pune-Plant-A', 'Chennai-Plant-B', 'Bengaluru-Plant-C', 'Nagpur-Plant-D', 'Ahmedabad-Plant-E'];
  const MACHINE_TYPES = ['CNC Lathe', 'Hydraulic Press', 'Conveyor Motor', 'Industrial Robot Arm', 'Blower Fan', 'Compressor', 'Welding Unit'];
  const MANUFACTURERS = ['Siemens', 'ABB', 'Schneider Electric', 'Honeywell', 'Mitsubishi Electric', 'Rockwell Automation'];
  const cols = [
    { name: 'reading_id', gen: (i) => `RDG${pad(i + 1, 10)}` },
    { name: 'device_id', gen: () => `DEV-${pad(int(1, 20000), 6)}` },
    { name: 'plant', gen: () => pick(PLANTS) },
    { name: 'production_line', gen: () => `LINE-${int(1, 24)}` },
    { name: 'machine_type', gen: () => pick(MACHINE_TYPES) },
    { name: 'manufacturer', gen: () => pick(MANUFACTURERS) },
    { name: 'firmware_version', gen: () => `v${int(1, 9)}.${int(0, 20)}.${int(0, 9)}` },
    { name: 'timestamp', gen: () => isoDateTime(int, 2024, 2026) },
    { name: 'shift', gen: () => pick(['Morning', 'Afternoon', 'Night']) },
    { name: 'operator_id', gen: () => `OP${pad(int(1, 900), 4)}` },
    { name: 'temperature_c', gen: () => dec(-10, 180, 2) },
    { name: 'pressure_bar', gen: () => dec(0, 300, 2) },
    { name: 'vibration_mm_s', gen: () => dec(0, 25, 3) },
    { name: 'rpm', gen: () => int(0, 12000) },
    { name: 'voltage_v', gen: () => dec(190, 460, 1) },
    { name: 'current_a', gen: () => dec(0, 200, 2) },
    { name: 'power_factor', gen: () => dec(0.5, 1, 3) },
    { name: 'energy_consumed_kwh', gen: () => dec(0, 5000, 2) },
    { name: 'humidity_pct', gen: () => dec(10, 95, 1) },
    { name: 'noise_level_db', gen: () => dec(40, 120, 1) },
    { name: 'oil_level_pct', gen: () => dec(0, 100, 1) },
    { name: 'coolant_level_pct', gen: () => dec(0, 100, 1) },
    { name: 'error_code', gen: () => (bool(0.05) ? `E${int(100, 999)}` : '') },
    { name: 'warning_flag', gen: () => bool(0.1) },
    { name: 'critical_flag', gen: () => bool(0.01) },
    { name: 'maintenance_due', gen: () => bool(0.07) },
    { name: 'uptime_hours', gen: () => dec(0, 8760, 1) },
    { name: 'downtime_minutes_today', gen: () => int(0, 480) },
    { name: 'batch_id', gen: () => `BATCH-${pad(int(1, 90000), 6)}` },
    { name: 'units_produced', gen: () => int(0, 5000) },
    { name: 'defect_count', gen: () => int(0, 50) },
    { name: 'quality_score', gen: () => dec(0, 100, 1) },
    { name: 'firmware_update_pending', gen: () => bool(0.15) },
    { name: 'network_latency_ms', gen: () => dec(1, 500, 1) },
    { name: 'signal_strength_dbm', gen: () => dec(-100, -30, 1) },
    { name: 'battery_level_pct', gen: () => dec(0, 100, 1) },
    { name: 'gps_lat', gen: () => dec(8, 34, 6) },
    { name: 'gps_lon', gen: () => dec(68, 97, 6) },
    { name: 'installed_date', gen: () => isoDate(int, 2015, 2025) },
    { name: 'last_serviced_date', gen: () => isoDate(int, 2024, 2026) },
    { name: 'warranty_expiry', gen: () => isoDate(int, 2025, 2030) },
  ];
  for (let s = 1; s <= 68; s++) cols.push({ name: `sensor_channel_${pad(s, 2)}`, gen: () => dec(-500, 500, 4) });
  return cols;
}

/* ============================================================
   Topic 3 (XLSX) — Hospital Patient Clinical Encounters
   ============================================================ */
function clinicalColumns(h) {
  const { pick, int, dec, bool } = h;
  const DEPARTMENTS = ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Oncology', 'Emergency', 'General Medicine', 'Dermatology', 'ENT', 'Psychiatry'];
  const DIAGNOSES = ['Hypertension', 'Type 2 Diabetes', 'Asthma', 'Migraine', 'Fracture', 'Pneumonia', 'Anemia', 'Anxiety Disorder', 'Gastritis', 'Arrhythmia'];
  const MEDICATIONS = ['Metformin', 'Amlodipine', 'Atorvastatin', 'Salbutamol', 'Paracetamol', 'Omeprazole', 'Sertraline', 'Insulin Glargine', 'Amoxicillin', 'Ibuprofen'];
  const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const cols = [
    { name: 'encounter_id', gen: (i) => `ENC${pad(i + 1, 10)}` },
    { name: 'patient_id', gen: () => `PAT${pad(int(1, 300000), 7)}` },
    { name: 'patient_age', gen: () => int(0, 100) },
    { name: 'patient_gender', gen: () => pick(['Male', 'Female', 'Other']) },
    { name: 'blood_group', gen: () => pick(BLOOD_GROUPS) },
    { name: 'admission_date', gen: () => isoDate(int, 2020, 2026) },
    { name: 'discharge_date', gen: () => isoDate(int, 2020, 2026) },
    { name: 'department', gen: () => pick(DEPARTMENTS) },
    { name: 'attending_physician', gen: () => `Dr. ${pick(['Rao', 'Mehta', 'Iyer', 'Khan', 'Das', 'Fernandes', 'Chopra', 'Malhotra'])}` },
    { name: 'ward', gen: () => `Ward-${int(1, 40)}` },
    { name: 'bed_number', gen: () => `B${int(1, 400)}` },
    { name: 'admission_type', gen: () => pick(['Emergency', 'Elective', 'Referral', 'Transfer']) },
    { name: 'primary_diagnosis', gen: () => pick(DIAGNOSES) },
    { name: 'secondary_diagnosis', gen: () => (bool(0.4) ? pick(DIAGNOSES) : '') },
    { name: 'icd_code', gen: () => `ICD-${int(1, 999)}.${int(0, 9)}` },
    { name: 'medication_prescribed', gen: () => pick(MEDICATIONS) },
    { name: 'dosage_mg', gen: () => pick([5, 10, 25, 50, 100, 250, 500]) },
    { name: 'heart_rate_bpm', gen: () => int(45, 160) },
    { name: 'systolic_bp', gen: () => int(90, 180) },
    { name: 'diastolic_bp', gen: () => int(50, 120) },
    { name: 'temperature_f', gen: () => dec(95, 104, 1) },
    { name: 'respiratory_rate', gen: () => int(10, 30) },
    { name: 'oxygen_saturation_pct', gen: () => dec(80, 100, 1) },
    { name: 'weight_kg', gen: () => dec(3, 150, 1) },
    { name: 'height_cm', gen: () => dec(45, 200, 1) },
    { name: 'bmi', gen: () => dec(12, 45, 1) },
    { name: 'glucose_mg_dl', gen: () => dec(60, 300, 1) },
    { name: 'cholesterol_mg_dl', gen: () => dec(100, 300, 1) },
    { name: 'hemoglobin_g_dl', gen: () => dec(6, 18, 1) },
    { name: 'white_blood_cell_count', gen: () => dec(3, 20, 2) },
    { name: 'platelet_count', gen: () => int(50000, 500000) },
    { name: 'allergy_flag', gen: () => bool(0.2) },
    { name: 'allergy_details', gen: () => (bool(0.2) ? pick(['Penicillin', 'Peanuts', 'Latex', 'Dust', 'Pollen']) : '') },
    { name: 'insurance_provider', gen: () => pick(['Star Health', 'HDFC Ergo', 'ICICI Lombard', 'Max Bupa', 'None']) },
    { name: 'insurance_claim_amount', gen: () => dec(0, 500000) },
    { name: 'bill_amount', gen: () => dec(500, 800000) },
    { name: 'payment_status', gen: () => pick(['Paid', 'Pending', 'Partially Paid', 'Waived']) },
    { name: 'readmission_flag', gen: () => bool(0.1) },
    { name: 'icu_flag', gen: () => bool(0.12) },
    { name: 'surgery_performed', gen: () => bool(0.18) },
    { name: 'discharge_status', gen: () => pick(['Recovered', 'Referred', 'Transferred', 'Deceased', 'Left Against Advice']) },
    { name: 'follow_up_required', gen: () => bool(0.5) },
  ];
  for (let l = 1; l <= 66; l++) cols.push({ name: `lab_panel_${pad(l, 2)}`, gen: () => dec(0, 500, 2) });
  return cols;
}

/* ============================================================
   Topic 4 (SQLite) — Bank Transaction Ledger
   ============================================================ */
function bankingColumns(h) {
  const { pick, int, dec, bool } = h;
  const BRANCHES = ['Mumbai-Fort', 'Delhi-CP', 'Bengaluru-MG-Road', 'Chennai-Anna-Nagar', 'Pune-FC-Road', 'Hyderabad-Banjara-Hills', 'Kolkata-Park-Street'];
  const cols = [
    { name: 'ledger_entry_id', gen: (i) => `LED${pad(i + 1, 11)}` },
    { name: 'account_number', gen: () => String(int(1000000000, 9999999999)) },
    { name: 'account_type', gen: () => pick(['Savings', 'Current', 'Fixed Deposit', 'NRE', 'NRO']) },
    { name: 'account_holder_name', gen: () => `${pick(['Ravi', 'Sunita', 'Arjun', 'Meera', 'Vikram', 'Neha', 'Karan', 'Pooja'])} ${pick(['Agarwal', 'Bhatt', 'Chatterjee', 'Desai', 'Joshi', 'Kapoor', 'Menon', 'Rana'])}` },
    { name: 'branch', gen: () => pick(BRANCHES) },
    { name: 'ifsc_code', gen: () => `SBIN0${pad(int(1, 99999), 6)}` },
    { name: 'transaction_id', gen: (i) => `FTXN${pad(i + 1, 11)}` },
    { name: 'transaction_date', gen: () => isoDate(int, 2018, 2026) },
    { name: 'transaction_time', gen: () => `${pad(int(0, 23), 2)}:${pad(int(0, 59), 2)}:${pad(int(0, 59), 2)}` },
    { name: 'transaction_type', gen: () => pick(['Debit', 'Credit']) },
    { name: 'transaction_mode', gen: () => pick(['NEFT', 'RTGS', 'IMPS', 'UPI', 'Cheque', 'Cash Deposit', 'ATM Withdrawal', 'Card Payment']) },
    { name: 'amount', gen: () => dec(10, 1000000) },
    { name: 'currency', gen: () => 'INR' },
    { name: 'balance_after_transaction', gen: () => dec(0, 5000000) },
    { name: 'counterparty_name', gen: () => `${pick(['Ravi', 'Sunita', 'Arjun', 'Meera', 'Vikram'])} ${pick(['Agarwal', 'Bhatt', 'Chatterjee', 'Desai', 'Joshi'])}` },
    { name: 'counterparty_account', gen: () => String(int(1000000000, 9999999999)) },
    { name: 'counterparty_bank', gen: () => pick(['SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra', 'Punjab National Bank']) },
    { name: 'merchant_category_code', gen: () => `MCC${int(1000, 9999)}` },
    { name: 'merchant_name', gen: () => pick(['Amazon', 'Flipkart', 'Swiggy', 'Zomato', 'BigBasket', 'IRCTC', 'BSES Electricity', 'Airtel', 'Reliance Petrol']) },
    { name: 'channel', gen: () => pick(['Mobile Banking', 'Net Banking', 'Branch', 'ATM', 'POS']) },
    { name: 'device_id', gen: () => `DVC-${int(100000, 999999)}` },
    { name: 'ip_address', gen: () => `${int(1, 255)}.${int(0, 255)}.${int(0, 255)}.${int(1, 254)}` },
    { name: 'location_city', gen: () => pick(['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Pune', 'Hyderabad', 'Kolkata']) },
    { name: 'is_international', gen: () => bool(0.05) },
    { name: 'is_recurring', gen: () => bool(0.15) },
    { name: 'standing_instruction_id', gen: () => (bool(0.15) ? `SI${pad(int(1, 90000), 6)}` : '') },
    { name: 'cheque_number', gen: () => (bool(0.1) ? String(int(100000, 999999)) : '') },
    { name: 'reference_number', gen: () => `REF${pad(int(1, 9999999), 8)}` },
    { name: 'transaction_status', gen: () => pick(['Success', 'Pending', 'Failed', 'Reversed']) },
    { name: 'failure_reason', gen: () => (bool(0.03) ? pick(['Insufficient Funds', 'Invalid Account', 'Timeout', 'Fraud Suspected']) : '') },
    { name: 'fraud_score', gen: () => dec(0, 100, 2) },
    { name: 'fraud_flag', gen: () => bool(0.008) },
    { name: 'kyc_verified', gen: () => bool(0.96) },
    { name: 'aml_flag', gen: () => bool(0.005) },
    { name: 'tax_deducted', gen: () => dec(0, 5000) },
    { name: 'gst_applicable', gen: () => bool(0.2) },
    { name: 'card_last_four', gen: () => pad(int(0, 9999), 4) },
    { name: 'card_network', gen: () => pick(['Visa', 'Mastercard', 'RuPay', 'Amex', '']) },
    { name: 'relationship_manager_id', gen: () => `RM${pad(int(1, 500), 4)}` },
    { name: 'customer_since', gen: () => isoDate(int, 2005, 2024) },
    { name: 'credit_score', gen: () => int(300, 900) },
  ];
  for (let r = 1; r <= 68; r++) cols.push({ name: `risk_factor_${pad(r, 2)}`, gen: () => dec(-100, 100, 4) });
  return cols;
}

// Windows chokes (ERR_SYSTEM_ERROR: writev failed) once too many unflushed
// writes queue up in libuv's write buffer — write() returning false means
// the internal buffer is full, so wait for 'drain' before continuing instead
// of piling on more writes.
async function writeChunk(stream, chunk) {
  if (!stream.write(chunk)) {
    await new Promise((resolve) => stream.once('drain', resolve));
  }
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function buildRow(columns, i) {
  const row = {};
  for (const col of columns) row[col.name] = col.gen(i);
  return row;
}

/* ---------- per-format writers, each returns bytes written ---------- */

async function genCsv(columns, rowCount, outPath, seed) {
  const h = makeHelpers(seed);
  const cols = columns(h);
  const ws = fs.createWriteStream(outPath);
  await writeChunk(ws, cols.map((c) => c.name).join(',') + '\n');
  for (let i = 0; i < rowCount; i++) {
    const row = buildRow(cols, i);
    await writeChunk(ws, cols.map((c) => csvEscape(row[c.name])).join(',') + '\n');
  }
  await new Promise((resolve, reject) => {
    ws.on('error', reject);
    ws.end(resolve);
  });
  return { cols: cols.length };
}

async function genJson(columns, rowCount, outPath, seed) {
  const h = makeHelpers(seed);
  const cols = columns(h);
  const ws = fs.createWriteStream(outPath);
  await writeChunk(ws, '[\n');
  for (let i = 0; i < rowCount; i++) {
    const row = buildRow(cols, i);
    await writeChunk(ws, (i > 0 ? ',\n' : '') + JSON.stringify(row));
  }
  await writeChunk(ws, '\n]\n');
  await new Promise((resolve, reject) => {
    ws.on('error', reject);
    ws.end(resolve);
  });
  return { cols: cols.length };
}

async function genXlsx(columns, rowCount, outPath, seed) {
  const h = makeHelpers(seed);
  const cols = columns(h);
  // exceljs's per-row stream.write() ignores backpressure, so if zlib can't
  // compress as fast as rows are generated, the gap gets buffered in memory
  // (observed: multi-GB of heap growth while the file itself stayed a few MB).
  // A low compression level keeps the zip pipeline fast enough to not fall behind.
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: outPath,
    useStyles: false,
    useSharedStrings: false,
    zip: { zlib: { level: 1 } },
  });
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.columns = cols.map((c) => ({ header: c.name, key: c.name }));
  // addRow().commit() has no backpressure signal of its own; yielding to the
  // event loop periodically lets the underlying zip/write pipe actually drain
  // instead of letting exceljs's internal buffers grow unbounded (the same
  // class of issue that crashed the raw fs.write() loop in genCsv/genJson).
  for (let i = 0; i < rowCount; i++) {
    sheet.addRow(buildRow(cols, i)).commit();
    if (i % 5000 === 0) await new Promise((resolve) => setImmediate(resolve));
  }
  sheet.commit();
  await workbook.commit();
  return { cols: cols.length };
}

function genSqlite(columns, rowCount, outPath, seed, tableName) {
  const h = makeHelpers(seed);
  const cols = columns(h);
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  const db = new DatabaseSync(outPath);
  db.exec(`CREATE TABLE ${tableName} (${cols.map((c) => `"${c.name}" TEXT`).join(', ')})`);
  const stmt = db.prepare(`INSERT INTO ${tableName} VALUES (${cols.map(() => '?').join(', ')})`);
  const BATCH = 3000;
  for (let start = 0; start < rowCount; start += BATCH) {
    db.exec('BEGIN');
    const end = Math.min(start + BATCH, rowCount);
    for (let i = start; i < end; i++) {
      const row = buildRow(cols, i);
      stmt.run(...cols.map((c) => {
        const v = row[c.name];
        return typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
      }));
    }
    db.exec('COMMIT');
  }
  db.close();
  return { cols: cols.length };
}

/* ---------- calibrate: generate a small sample, measure bytes/row ---------- */

async function calibrate(genFn, label) {
  const tmpPath = path.join(OUT_DIR, `._calibrate_${label}.tmp`);
  await genFn(CALIBRATION_ROWS, tmpPath);
  const bytes = fs.statSync(tmpPath).size;
  fs.unlinkSync(tmpPath);
  const bytesPerRow = bytes / CALIBRATION_ROWS;
  let rows = Math.ceil(TARGET_BYTES / bytesPerRow);
  const floorRows = Math.ceil(FLOOR_BYTES / bytesPerRow);
  if (rows < floorRows) rows = floorRows;
  console.log(`[calibrate] ${label}: ${bytesPerRow.toFixed(1)} bytes/row -> targeting ${rows.toLocaleString()} rows for ~${(rows * bytesPerRow / 1024 ** 3).toFixed(2)}GB`);
  return rows;
}

// Pass which formats to (re)generate as argv, e.g. `node generate-sample-data.js xlsx sqlite`
// — lets a failed/slow format be retried without redoing the ones that already succeeded.
const REQUESTED = process.argv.slice(2);
const want = (fmt) => REQUESTED.length === 0 || REQUESTED.includes(fmt);

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const t0 = Date.now();

  console.log('=== Calibrating row counts for ~2.5GB each ===');
  const csvRows = want('csv') && await calibrate((n, p) => genCsv(retailColumns, n, p, 1), 'csv');
  const jsonRows = want('json') && await calibrate((n, p) => genJson(iotColumns, n, p, 2), 'json');
  const xlsxRows = want('xlsx') && await calibrate((n, p) => genXlsx(clinicalColumns, n, p, 3), 'xlsx');
  const sqliteRows = want('sqlite') && await calibrate((n, p) => genSqlite(bankingColumns, n, p, 4, 'ledger_calibrate'), 'sqlite');

  if (want('csv')) {
    console.log('\n=== Generating CSV: Global Retail Order Transactions ===');
    let t = Date.now();
    let r = await genCsv(retailColumns, csvRows, path.join(OUT_DIR, 'retail_orders.csv'), 1);
    console.log(`  ${csvRows.toLocaleString()} rows x ${r.cols} cols, ${((Date.now() - t) / 1000).toFixed(1)}s, ${(fs.statSync(path.join(OUT_DIR, 'retail_orders.csv')).size / 1024 ** 3).toFixed(2)}GB`);
  }

  if (want('json')) {
    console.log('\n=== Generating JSON: Industrial IoT Sensor Telemetry ===');
    let t = Date.now();
    let r = await genJson(iotColumns, jsonRows, path.join(OUT_DIR, 'iot_sensor_telemetry.json'), 2);
    console.log(`  ${jsonRows.toLocaleString()} rows x ${r.cols} cols, ${((Date.now() - t) / 1000).toFixed(1)}s, ${(fs.statSync(path.join(OUT_DIR, 'iot_sensor_telemetry.json')).size / 1024 ** 3).toFixed(2)}GB`);
  }

  if (want('xlsx')) {
    console.log('\n=== Generating XLSX: Hospital Patient Clinical Encounters ===');
    let t = Date.now();
    let r = await genXlsx(clinicalColumns, xlsxRows, path.join(OUT_DIR, 'hospital_clinical_encounters.xlsx'), 3);
    console.log(`  ${xlsxRows.toLocaleString()} rows x ${r.cols} cols, ${((Date.now() - t) / 1000).toFixed(1)}s, ${(fs.statSync(path.join(OUT_DIR, 'hospital_clinical_encounters.xlsx')).size / 1024 ** 3).toFixed(2)}GB`);
  }

  if (want('sqlite')) {
    console.log('\n=== Generating SQLite: Bank Transaction Ledger ===');
    let t = Date.now();
    let r = genSqlite(bankingColumns, sqliteRows, path.join(OUT_DIR, 'bank_transaction_ledger.db'), 4, 'ledger');
    console.log(`  ${sqliteRows.toLocaleString()} rows x ${r.cols} cols, ${((Date.now() - t) / 1000).toFixed(1)}s, ${(fs.statSync(path.join(OUT_DIR, 'bank_transaction_ledger.db')).size / 1024 ** 3).toFixed(2)}GB`);
  }

  console.log(`\nAll done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
