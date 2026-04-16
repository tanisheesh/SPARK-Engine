const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function generateAllDatabases() {
  console.log('🚀 Starting mass data generation for all databases...\n');
  
  try {
    // Generate SQLite data (fastest, no server needed)
    console.log('═══════════════════════════════════════════════════════');
    console.log('1️⃣  GENERATING SQLITE DATABASE');
    console.log('═══════════════════════════════════════════════════════\n');
    await execPromise('node scripts/generate-sqlite-data.js');
    console.log('\n✅ SQLite generation complete!\n');

    // Generate MySQL data
    console.log('═══════════════════════════════════════════════════════');
    console.log('2️⃣  GENERATING MYSQL DATABASE');
    console.log('═══════════════════════════════════════════════════════\n');
    await execPromise('node scripts/generate-mysql-data.js');
    console.log('\n✅ MySQL generation complete!\n');

    // Generate PostgreSQL data
    console.log('═══════════════════════════════════════════════════════');
    console.log('3️⃣  GENERATING POSTGRESQL DATABASE');
    console.log('═══════════════════════════════════════════════════════\n');
    await execPromise('node scripts/generate-postgres-data.js');
    console.log('\n✅ PostgreSQL generation complete!\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 ALL DATABASES GENERATED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n📊 TOTAL SUMMARY:');
    console.log('  SQLite:     950,000 records (employees, projects, assignments, time logs)');
    console.log('  MySQL:      760,000 records (users, products, orders, activity logs)');
    console.log('  PostgreSQL: 950,000 records (customers, transactions, tickets, events)');
    console.log('  ─────────────────────────────────────────────────────');
    console.log('  GRAND TOTAL: 2,660,000 records across 3 databases! 🚀\n');

    console.log('📝 CONNECTION DETAILS:\n');
    console.log('SQLite:');
    console.log('  File: spark_engine_test.db (in project root)');
    console.log('  Tables: employees, projects, project_assignments, time_logs\n');
    
    console.log('MySQL:');
    console.log('  Host: localhost:3306');
    console.log('  Database: spark_engine_test');
    console.log('  Tables: users, products, orders, activity_logs\n');
    
    console.log('PostgreSQL:');
    console.log('  Host: localhost:5432');
    console.log('  Database: spark_engine_test');
    console.log('  Tables: customers, transactions, support_tickets, system_events\n');

  } catch (error) {
    console.error('❌ Error during generation:', error.message);
    console.error('\n💡 Make sure:');
    console.error('  - MySQL server is running on localhost:3306');
    console.error('  - PostgreSQL server is running on localhost:5432');
    console.error('  - Credentials in scripts match your setup');
    process.exit(1);
  }
}

generateAllDatabases();
