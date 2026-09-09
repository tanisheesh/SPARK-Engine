from db import get_connection


def generate_er_diagram(database):
    conn = get_connection(database)
    cursor = conn.cursor()

    # Get tables
    cursor.execute("SHOW TABLES;")
    tables = [t[0] for t in cursor.fetchall()]

    entities = []
    relationships = []

    for table in tables:
        cursor.execute(f"DESCRIBE {table};")
        columns = cursor.fetchall()

        entity = {
            "name": table,
            "attributes": [col[0] for col in columns]
        }
        entities.append(entity)

    # Foreign key relationships
    cursor.execute("""
        SELECT 
            TABLE_NAME,
            COLUMN_NAME,
            REFERENCED_TABLE_NAME,
            REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = %s
        AND REFERENCED_TABLE_NAME IS NOT NULL;
    """, (database,))

    for row in cursor.fetchall():
        relationships.append({
            "from_table": row[0],
            "from_column": row[1],
            "to_table": row[2],
            "to_column": row[3]
        })

    cursor.close()
    conn.close()

    return {
        "entities": entities,
        "relationships": relationships
    }
    