# SPARK Engine - Data Upload & Connection Flow

## Overview
SPARK Engine uses DuckDB as an in-memory analytical database. All data sources (CSV, MySQL, PostgreSQL, SQLite) are imported into DuckDB for querying.

## Data Source Flow

### 1. CSV Files
**Upload Process:**
- User selects CSV file (any size, even 100GB+)
- System stores only the **file path** (no copying)
- On "Connect" button click:
  - DuckDB imports CSV directly from path
  - Table created: `<filename>` (sanitized)
  - Import happens in background for large files

**Example:**
```
File: activity_logs.csv
Path: D:\data\activity_logs.csv
Table: activity_logs
```

### 2. MySQL Database
**Connection Process:**
- User provides: host, port, user, password, database
- On "Connect" button click:
  - All tables imported into DuckDB
  - Table naming: `mysql_<database>_<table>`
  - Foreign keys preserved

**Example:**
```
Database: ecommerce
Tables: users, orders, products
DuckDB Tables: 
  - mysql_ecommerce_users
  - mysql_ecommerce_orders
  - mysql_ecommerce_products
```

### 3. PostgreSQL Database
**Connection Process:**
- User provides: host, port, user, password, database
- On "Connect" button click:
  - All tables imported into DuckDB
  - Table naming: `postgres_<database>_<table>`
  - Foreign keys preserved

**Example:**
```
Database: analytics
Tables: events, sessions
DuckDB Tables:
  - postgres_analytics_events
  - postgres_analytics_sessions
```

### 4. SQLite Database
**Connection Process:**
- User selects SQLite file
- On "Connect" button click:
  - All tables imported into DuckDB
  - Table naming: `sqlite_<filename>_<table>`
  - Foreign keys preserved

**Example:**
```
File: app.db
Tables: users, logs
DuckDB Tables:
  - sqlite_app_users
  - sqlite_app_logs
```

## DuckDB Lifecycle

### App Startup
1. Check for existing DuckDB file: `AppData/Roaming/spark-engine/data.duckdb`
2. **Clean all tables** (fresh start every time)
3. Ready for new connections

### During Session
- Only ONE data source active at a time
- Switching sources = disconnect old + connect new
- DuckDB tables persist during session

### Disconnect
- User clicks "Disconnect" button
- All tables from that source deleted from DuckDB
- DuckDB file remains (empty)

### App Shutdown
- DuckDB file persists on disk
- Next startup = automatic cleanup

## File Locations

### Settings Directory
```
Windows: C:\Users\<username>\AppData\Roaming\spark-engine\
Linux: ~/.config/spark-engine/
macOS: ~/Library/Application Support/spark-engine/
```

### Files
- `data.duckdb` - Main DuckDB database
- `settings.json` - API keys and preferences
- `file-references.json` - CSV file paths (for large files)
- `uploads/` - Small CSV files (<500MB)

## Query Flow

### 1. User asks question
```
"How many users are there?"
```

### 2. System analyzes available tables
- CSV: `activity_logs`
- MySQL: `mysql_ecommerce_users`, `mysql_ecommerce_orders`
- etc.

### 3. Groq generates SQL
```sql
SELECT COUNT(*) FROM mysql_ecommerce_users
```

### 4. DuckDB executes query
- Fast analytical queries
- Handles large datasets efficiently

### 5. Groq formats response
```
"There are 10,000 users in the database."
```

## Benefits

### Performance
- DuckDB is optimized for analytics
- Columnar storage = fast aggregations
- Handles 100GB+ files efficiently

### Simplicity
- Single query interface for all sources
- No need to maintain multiple connections
- Consistent SQL dialect

### Memory Management
- DuckDB uses disk for large datasets
- Automatic memory optimization
- No manual tuning needed

## Error Handling

### CSV Import Fails
- Show error message
- Keep file reference
- Allow retry

### Database Connection Fails
- Show connection error
- Don't create DuckDB tables
- Allow reconnect

### DuckDB Corruption
- Delete `data.duckdb`
- Restart app
- Fresh start

## Best Practices

### For Users
1. Keep CSV files in stable locations (don't move after connecting)
2. Disconnect before closing app (clean shutdown)
3. One data source at a time
4. Large files (>10GB) may take 1-2 minutes to import

### For Developers
1. Always sanitize table names (alphanumeric + underscore only)
2. Use parameterized queries (prevent SQL injection)
3. Handle timeouts for large imports
4. Log all DuckDB operations
5. Clean up on errors

## Troubleshooting

### "No tables found"
- Reconnect to data source
- Check DuckDB file exists
- Restart app (triggers cleanup)

### "Import taking too long"
- Large files (>50GB) can take 5-10 minutes
- Check console logs for progress
- Don't close app during import

### "Query failed"
- Check table names in error message
- Verify data source is connected
- Try simpler query first

## Future Enhancements

### Planned
- [ ] Multiple data sources simultaneously
- [ ] Incremental CSV updates
- [ ] Query caching
- [ ] Export results to CSV
- [ ] Scheduled imports

### Under Consideration
- [ ] Cloud storage support (S3, GCS)
- [ ] Real-time database sync
- [ ] Custom SQL editor
- [ ] Query history
