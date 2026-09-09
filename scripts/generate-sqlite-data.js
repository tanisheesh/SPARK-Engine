const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// SQLite Mass Data Generator
function generateSQLiteData() {
  console.log('💾 Starting SQLite data generation...');
  
  const dbPath = path.join(__dirname, '..', 'spark_engine_test.db');
  
  // Remove existing database
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🗑️  Removed existing database');
  }

  const db = new Database(dbPath);
  
  console.log('✅ Database created at:', dbPath);

  // Create tables with relations
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      employee_id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      department TEXT,
      position TEXT,
      salary REAL,
      hire_date TEXT,
      manager_id INTEGER,
      employment_status TEXT,
      performance_rating REAL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      project_id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT,
      project_code TEXT,
      client_name TEXT,
      start_date TEXT,
      end_date TEXT,
      budget REAL,
      actual_cost REAL,
      project_status TEXT,
      priority TEXT,
      team_size INTEGER
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS project_assignments (
      assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      project_id INTEGER,
      role TEXT,
      hours_allocated INTEGER,
      hours_worked INTEGER,
      assignment_date TEXT,
      completion_percentage REAL,
      FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
      FOREIGN KEY (project_id) REFERENCES projects(project_id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS time_logs (
      log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      project_id INTEGER,
      log_date TEXT,
      hours_worked REAL,
      task_description TEXT,
      task_type TEXT,
      billable INTEGER,
      approved INTEGER,
      FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
      FOREIGN KEY (project_id) REFERENCES projects(project_id)
    )
  `);

  console.log('✅ Tables created');

  // Generate data
  const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Support', 'Legal'];
  const positions = ['Manager', 'Senior', 'Junior', 'Lead', 'Specialist', 'Analyst', 'Coordinator', 'Director'];
  const statuses = ['active', 'on_leave', 'terminated', 'probation'];
  const projectStatuses = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'];
  const priorities = ['low', 'medium', 'high', 'critical'];
  const roles = ['Developer', 'Designer', 'Tester', 'Project Manager', 'Business Analyst', 'DevOps'];
  const taskTypes = ['development', 'testing', 'design', 'meeting', 'documentation', 'review'];

  console.log('👨‍💼 Generating 80,000 employees...');
  const insertEmployee = db.prepare(`
    INSERT INTO employees (first_name, last_name, email, phone, department, position, salary, hire_date, manager_id, employment_status, performance_rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((employees) => {
    for (const emp of employees) {
      insertEmployee.run(emp);
    }
  });

  const employeeBatch = [];
  for (let i = 1; i <= 80000; i++) {
    employeeBatch.push([
      `FirstName${i}`,
      `LastName${i}`,
      `employee${i}@company.com`,
      `+1-555-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      departments[Math.floor(Math.random() * departments.length)],
      positions[Math.floor(Math.random() * positions.length)],
      Math.floor(Math.random() * 150000) + 40000,
      `${2015 + Math.floor(Math.random() * 10)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
      i > 100 ? Math.floor(Math.random() * (i - 1)) + 1 : null,
      statuses[Math.floor(Math.random() * statuses.length)],
      (Math.random() * 5).toFixed(2)
    ]);

    if (employeeBatch.length === 1000) {
      insertMany(employeeBatch);
      employeeBatch.length = 0;
      console.log(`  ✓ ${i} employees inserted`);
    }
  }
  if (employeeBatch.length > 0) {
    insertMany(employeeBatch);
  }

  console.log('📁 Generating 20,000 projects...');
  const insertProject = db.prepare(`
    INSERT INTO projects (project_name, project_code, client_name, start_date, end_date, budget, actual_cost, project_status, priority, team_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertProjectsMany = db.transaction((projects) => {
    for (const proj of projects) {
      insertProject.run(proj);
    }
  });

  const projectBatch = [];
  for (let i = 1; i <= 20000; i++) {
    const budget = Math.floor(Math.random() * 1000000) + 50000;
    projectBatch.push([
      `Project ${i}`,
      `PROJ-${String(i).padStart(5, '0')}`,
      `Client ${Math.floor(Math.random() * 1000) + 1}`,
      `${2020 + Math.floor(Math.random() * 5)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
      `${2021 + Math.floor(Math.random() * 5)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
      budget,
      budget * (0.7 + Math.random() * 0.5),
      projectStatuses[Math.floor(Math.random() * projectStatuses.length)],
      priorities[Math.floor(Math.random() * priorities.length)],
      Math.floor(Math.random() * 20) + 3
    ]);

    if (projectBatch.length === 1000) {
      insertProjectsMany(projectBatch);
      projectBatch.length = 0;
      console.log(`  ✓ ${i} projects inserted`);
    }
  }
  if (projectBatch.length > 0) {
    insertProjectsMany(projectBatch);
  }

  console.log('📋 Generating 250,000 project assignments...');
  const insertAssignment = db.prepare(`
    INSERT INTO project_assignments (employee_id, project_id, role, hours_allocated, hours_worked, assignment_date, completion_percentage)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAssignmentsMany = db.transaction((assignments) => {
    for (const assign of assignments) {
      insertAssignment.run(assign);
    }
  });

  const assignmentBatch = [];
  for (let i = 1; i <= 250000; i++) {
    const hoursAllocated = Math.floor(Math.random() * 500) + 50;
    assignmentBatch.push([
      Math.floor(Math.random() * 80000) + 1,
      Math.floor(Math.random() * 20000) + 1,
      roles[Math.floor(Math.random() * roles.length)],
      hoursAllocated,
      Math.floor(Math.random() * hoursAllocated),
      `${2023 + Math.floor(Math.random() * 2)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
      (Math.random() * 100).toFixed(2)
    ]);

    if (assignmentBatch.length === 1000) {
      insertAssignmentsMany(assignmentBatch);
      assignmentBatch.length = 0;
      console.log(`  ✓ ${i} assignments inserted`);
    }
  }
  if (assignmentBatch.length > 0) {
    insertAssignmentsMany(assignmentBatch);
  }

  console.log('⏰ Generating 600,000 time logs...');
  const insertTimeLog = db.prepare(`
    INSERT INTO time_logs (employee_id, project_id, log_date, hours_worked, task_description, task_type, billable, approved)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTimeLogsMany = db.transaction((logs) => {
    for (const log of logs) {
      insertTimeLog.run(log);
    }
  });

  const timeLogBatch = [];
  for (let i = 1; i <= 600000; i++) {
    const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
    timeLogBatch.push([
      Math.floor(Math.random() * 80000) + 1,
      Math.floor(Math.random() * 20000) + 1,
      `${2024}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
      (Math.random() * 8 + 1).toFixed(2),
      `Worked on ${taskType} task for project`,
      taskType,
      Math.random() > 0.3 ? 1 : 0,
      Math.random() > 0.2 ? 1 : 0
    ]);

    if (timeLogBatch.length === 1000) {
      insertTimeLogsMany(timeLogBatch);
      timeLogBatch.length = 0;
      console.log(`  ✓ ${i} time logs inserted`);
    }
  }
  if (timeLogBatch.length > 0) {
    insertTimeLogsMany(timeLogBatch);
  }

  db.close();
  
  console.log('✅ SQLite data generation complete!');
  console.log('📊 Summary:');
  console.log('  - 80,000 employees');
  console.log('  - 20,000 projects');
  console.log('  - 250,000 project assignments');
  console.log('  - 600,000 time logs');
  console.log('  - Total: 950,000 records');
  console.log(`📁 Database location: ${dbPath}`);
}

generateSQLiteData();
