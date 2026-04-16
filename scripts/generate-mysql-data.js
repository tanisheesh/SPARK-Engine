const mysql = require('mysql2/promise');

// MySQL Mass Data Generator
async function generateMySQLData() {
  console.log('🐬 Starting MySQL data generation...');
  
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'Tanishpoddar.18',
  });

  // Create database
  await connection.query('CREATE DATABASE IF NOT EXISTS spark_engine_test');
  await connection.query('USE spark_engine_test');
  
  console.log('✅ Database created/selected');

  // Create tables with relations
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(100),
      email VARCHAR(150),
      age INT,
      country VARCHAR(50),
      registration_date DATETIME,
      account_status ENUM('active', 'inactive', 'suspended'),
      total_purchases DECIMAL(10,2) DEFAULT 0
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS products (
      product_id INT PRIMARY KEY AUTO_INCREMENT,
      product_name VARCHAR(200),
      category VARCHAR(100),
      price DECIMAL(10,2),
      stock_quantity INT,
      supplier VARCHAR(100),
      rating DECIMAL(3,2)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS orders (
      order_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT,
      product_id INT,
      order_date DATETIME,
      quantity INT,
      total_amount DECIMAL(10,2),
      order_status ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
      payment_method VARCHAR(50),
      shipping_address TEXT,
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      FOREIGN KEY (product_id) REFERENCES products(product_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      log_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT,
      activity_type VARCHAR(50),
      activity_description TEXT,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at DATETIME,
      session_duration INT,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    )
  `);

  console.log('✅ Tables created');

  // Generate data
  const countries = ['USA', 'UK', 'India', 'Canada', 'Australia', 'Germany', 'France', 'Japan', 'Brazil', 'Mexico'];
  const categories = ['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Toys', 'Food', 'Beauty'];
  const activities = ['login', 'logout', 'view_product', 'add_to_cart', 'checkout', 'search', 'profile_update'];
  const statuses = ['active', 'inactive', 'suspended'];
  const orderStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  const paymentMethods = ['credit_card', 'debit_card', 'paypal', 'bank_transfer', 'cash_on_delivery'];

  console.log('📊 Generating 50,000 users...');
  const userBatch = [];
  for (let i = 1; i <= 50000; i++) {
    userBatch.push([
      `user${i}`,
      `user${i}@example.com`,
      Math.floor(Math.random() * 60) + 18,
      countries[Math.floor(Math.random() * countries.length)],
      new Date(2020 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      statuses[Math.floor(Math.random() * statuses.length)],
      (Math.random() * 10000).toFixed(2)
    ]);

    if (userBatch.length === 1000) {
      await connection.query(
        'INSERT INTO users (username, email, age, country, registration_date, account_status, total_purchases) VALUES ?',
        [userBatch]
      );
      userBatch.length = 0;
      console.log(`  ✓ ${i} users inserted`);
    }
  }

  console.log('📦 Generating 10,000 products...');
  const productBatch = [];
  for (let i = 1; i <= 10000; i++) {
    productBatch.push([
      `Product ${i}`,
      categories[Math.floor(Math.random() * categories.length)],
      (Math.random() * 1000 + 10).toFixed(2),
      Math.floor(Math.random() * 1000),
      `Supplier ${Math.floor(Math.random() * 100) + 1}`,
      (Math.random() * 5).toFixed(2)
    ]);

    if (productBatch.length === 1000) {
      await connection.query(
        'INSERT INTO products (product_name, category, price, stock_quantity, supplier, rating) VALUES ?',
        [productBatch]
      );
      productBatch.length = 0;
      console.log(`  ✓ ${i} products inserted`);
    }
  }

  console.log('🛒 Generating 200,000 orders...');
  const orderBatch = [];
  for (let i = 1; i <= 200000; i++) {
    const userId = Math.floor(Math.random() * 50000) + 1;
    const productId = Math.floor(Math.random() * 10000) + 1;
    const quantity = Math.floor(Math.random() * 10) + 1;
    const price = (Math.random() * 1000 + 10).toFixed(2);
    
    orderBatch.push([
      userId,
      productId,
      new Date(2023 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
      quantity,
      (price * quantity).toFixed(2),
      orderStatuses[Math.floor(Math.random() * orderStatuses.length)],
      paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
      `${Math.floor(Math.random() * 9999) + 1} Main St, City, Country`
    ]);

    if (orderBatch.length === 1000) {
      await connection.query(
        'INSERT INTO orders (user_id, product_id, order_date, quantity, total_amount, order_status, payment_method, shipping_address) VALUES ?',
        [orderBatch]
      );
      orderBatch.length = 0;
      console.log(`  ✓ ${i} orders inserted`);
    }
  }

  console.log('📝 Generating 500,000 activity logs...');
  const logBatch = [];
  for (let i = 1; i <= 500000; i++) {
    logBatch.push([
      Math.floor(Math.random() * 50000) + 1,
      activities[Math.floor(Math.random() * activities.length)],
      `User performed ${activities[Math.floor(Math.random() * activities.length)]} action`,
      `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1, Math.floor(Math.random() * 24), Math.floor(Math.random() * 60)),
      Math.floor(Math.random() * 3600)
    ]);

    if (logBatch.length === 1000) {
      await connection.query(
        'INSERT INTO activity_logs (user_id, activity_type, activity_description, ip_address, user_agent, created_at, session_duration) VALUES ?',
        [logBatch]
      );
      logBatch.length = 0;
      console.log(`  ✓ ${i} logs inserted`);
    }
  }

  await connection.end();
  
  console.log('✅ MySQL data generation complete!');
  console.log('📊 Summary:');
  console.log('  - 50,000 users');
  console.log('  - 10,000 products');
  console.log('  - 200,000 orders');
  console.log('  - 500,000 activity logs');
  console.log('  - Total: 760,000 records');
}

generateMySQLData().catch(console.error);
