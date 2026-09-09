const { Client } = require('pg');

// PostgreSQL Mass Data Generator
async function generatePostgreSQLData() {
  console.log('🐘 Starting PostgreSQL data generation...');
  
  const client = new Client({
    connectionString: 'postgresql://postgres:Tanishpoddar.18@localhost:5432/postgres'
  });

  await client.connect();

  // Create database
  try {
    await client.query('CREATE DATABASE spark_engine_test');
    console.log('✅ Database created');
  } catch (e) {
    console.log('ℹ️  Database already exists');
  }

  await client.end();

  // Connect to new database
  const dbClient = new Client({
    connectionString: 'postgresql://postgres:Tanishpoddar.18@localhost:5432/spark_engine_test'
  });

  await dbClient.connect();

  // Create tables with relations
  await dbClient.query(`
    CREATE TABLE IF NOT EXISTS customers (
      customer_id SERIAL PRIMARY KEY,
      customer_name VARCHAR(200),
      email VARCHAR(200),
      phone VARCHAR(20),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      country VARCHAR(100),
      postal_code VARCHAR(20),
      registration_date TIMESTAMP,
      loyalty_points INT DEFAULT 0,
      customer_tier VARCHAR(20)
    )
  `);

  await dbClient.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      transaction_id SERIAL PRIMARY KEY,
      customer_id INT REFERENCES customers(customer_id),
      transaction_date TIMESTAMP,
      transaction_type VARCHAR(50),
      amount DECIMAL(12,2),
      currency VARCHAR(10),
      payment_status VARCHAR(50),
      payment_gateway VARCHAR(100),
      merchant_id VARCHAR(100),
      card_type VARCHAR(50)
    )
  `);

  await dbClient.query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      ticket_id SERIAL PRIMARY KEY,
      customer_id INT REFERENCES customers(customer_id),
      subject VARCHAR(300),
      description TEXT,
      priority VARCHAR(20),
      status VARCHAR(50),
      category VARCHAR(100),
      assigned_agent VARCHAR(100),
      created_at TIMESTAMP,
      resolved_at TIMESTAMP,
      resolution_time_hours INT
    )
  `);

  await dbClient.query(`
    CREATE TABLE IF NOT EXISTS system_events (
      event_id SERIAL PRIMARY KEY,
      event_type VARCHAR(100),
      event_severity VARCHAR(20),
      event_source VARCHAR(200),
      event_message TEXT,
      event_data JSONB,
      server_name VARCHAR(100),
      ip_address VARCHAR(45),
      timestamp TIMESTAMP,
      user_id INT
    )
  `);

  console.log('✅ Tables created');

  // Generate data
  const countries = ['USA', 'UK', 'India', 'Canada', 'Australia', 'Germany', 'France', 'Japan', 'Brazil', 'Mexico'];
  const cities = ['New York', 'London', 'Mumbai', 'Toronto', 'Sydney', 'Berlin', 'Paris', 'Tokyo', 'Rio', 'Mexico City'];
  const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
  const transactionTypes = ['purchase', 'refund', 'subscription', 'donation', 'transfer'];
  const paymentStatuses = ['completed', 'pending', 'failed', 'refunded', 'cancelled'];
  const priorities = ['low', 'medium', 'high', 'critical'];
  const ticketStatuses = ['open', 'in_progress', 'resolved', 'closed', 'escalated'];
  const categories = ['Technical', 'Billing', 'Account', 'Product', 'Shipping', 'General'];
  const severities = ['info', 'warning', 'error', 'critical'];

  console.log('👥 Generating 100,000 customers...');
  for (let i = 1; i <= 100000; i++) {
    await dbClient.query(`
      INSERT INTO customers (customer_name, email, phone, address, city, state, country, postal_code, registration_date, loyalty_points, customer_tier)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      `Customer ${i}`,
      `customer${i}@example.com`,
      `+1-555-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      `${Math.floor(Math.random() * 9999) + 1} Main Street`,
      cities[Math.floor(Math.random() * cities.length)],
      `State ${Math.floor(Math.random() * 50) + 1}`,
      countries[Math.floor(Math.random() * countries.length)],
      String(Math.floor(Math.random() * 99999) + 10000),
      new Date(2020 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      Math.floor(Math.random() * 10000),
      tiers[Math.floor(Math.random() * tiers.length)]
    ]);

    if (i % 1000 === 0) {
      console.log(`  ✓ ${i} customers inserted`);
    }
  }

  console.log('💳 Generating 300,000 transactions...');
  for (let i = 1; i <= 300000; i++) {
    await dbClient.query(`
      INSERT INTO transactions (customer_id, transaction_date, transaction_type, amount, currency, payment_status, payment_gateway, merchant_id, card_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      Math.floor(Math.random() * 100000) + 1,
      new Date(2023 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1, Math.floor(Math.random() * 24), Math.floor(Math.random() * 60)),
      transactionTypes[Math.floor(Math.random() * transactionTypes.length)],
      (Math.random() * 5000 + 10).toFixed(2),
      'USD',
      paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)],
      ['Stripe', 'PayPal', 'Square', 'Authorize.net'][Math.floor(Math.random() * 4)],
      `MERCH${Math.floor(Math.random() * 10000)}`,
      ['Visa', 'Mastercard', 'Amex', 'Discover'][Math.floor(Math.random() * 4)]
    ]);

    if (i % 1000 === 0) {
      console.log(`  ✓ ${i} transactions inserted`);
    }
  }

  console.log('🎫 Generating 150,000 support tickets...');
  for (let i = 1; i <= 150000; i++) {
    const createdAt = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1, Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
    const resolutionHours = Math.floor(Math.random() * 72);
    const resolvedAt = new Date(createdAt.getTime() + resolutionHours * 3600000);

    await dbClient.query(`
      INSERT INTO support_tickets (customer_id, subject, description, priority, status, category, assigned_agent, created_at, resolved_at, resolution_time_hours)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      Math.floor(Math.random() * 100000) + 1,
      `Issue with ${categories[Math.floor(Math.random() * categories.length)]}`,
      `Customer reported an issue regarding their ${categories[Math.floor(Math.random() * categories.length)].toLowerCase()} concern. Needs immediate attention.`,
      priorities[Math.floor(Math.random() * priorities.length)],
      ticketStatuses[Math.floor(Math.random() * ticketStatuses.length)],
      categories[Math.floor(Math.random() * categories.length)],
      `Agent ${Math.floor(Math.random() * 50) + 1}`,
      createdAt,
      resolvedAt,
      resolutionHours
    ]);

    if (i % 1000 === 0) {
      console.log(`  ✓ ${i} tickets inserted`);
    }
  }

  console.log('📊 Generating 400,000 system events...');
  for (let i = 1; i <= 400000; i++) {
    await dbClient.query(`
      INSERT INTO system_events (event_type, event_severity, event_source, event_message, event_data, server_name, ip_address, timestamp, user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      ['api_call', 'database_query', 'cache_miss', 'authentication', 'authorization', 'error'][Math.floor(Math.random() * 6)],
      severities[Math.floor(Math.random() * severities.length)],
      ['web-server', 'api-server', 'database', 'cache', 'queue'][Math.floor(Math.random() * 5)],
      `System event occurred at ${new Date().toISOString()}`,
      JSON.stringify({ 
        request_id: `req_${Math.random().toString(36).substr(2, 9)}`,
        duration_ms: Math.floor(Math.random() * 1000),
        status_code: [200, 201, 400, 401, 403, 404, 500][Math.floor(Math.random() * 7)]
      }),
      `server-${Math.floor(Math.random() * 20) + 1}`,
      `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1, Math.floor(Math.random() * 24), Math.floor(Math.random() * 60)),
      Math.floor(Math.random() * 100000) + 1
    ]);

    if (i % 1000 === 0) {
      console.log(`  ✓ ${i} events inserted`);
    }
  }

  await dbClient.end();
  
  console.log('✅ PostgreSQL data generation complete!');
  console.log('📊 Summary:');
  console.log('  - 100,000 customers');
  console.log('  - 300,000 transactions');
  console.log('  - 150,000 support tickets');
  console.log('  - 400,000 system events');
  console.log('  - Total: 950,000 records');
}

generatePostgreSQLData().catch(console.error);
