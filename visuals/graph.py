from db import get_connection

def get_foreign_keys(database):
    connection = get_connection(database)
    cursor = connection.cursor()

    query = """
    SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE 
        TABLE_SCHEMA = %s
        AND REFERENCED_TABLE_NAME IS NOT NULL;
    """

    cursor.execute(query, (database,))
    results = cursor.fetchall()

    cursor.close()
    connection.close()

    return results


def build_graph(database):
    fk_data = get_foreign_keys(database)

    graph = {}

    for row in fk_data:
        table, column, ref_table, ref_column = row

        if table not in graph:
            graph[table] = []

        if ref_table not in graph:
            graph[ref_table] = []

        # Undirected graph (important for BFS)
        graph[table].append(ref_table)
        graph[ref_table].append(table)

    return graph


def bfs_multi(graph, relevant_tables):
    if not relevant_tables:
        return []
        
    if len(relevant_tables) == 1:
        return [relevant_tables[0]]
        
    from collections import deque
    
    # Start with the first table
    start_node = relevant_tables[0]
    total_path = {start_node}
    
    # Connect each subsequent relevant table to the existing "island" of connected tables
    for i in range(1, len(relevant_tables)):
        target = relevant_tables[i]
        if target in total_path:
            continue
            
        # BFS to find shortest path from ANY node in total_path to target
        queue = deque([[node] for node in total_path])
        visited = set(total_path)
        found_path = None
        
        while queue:
            current_path = queue.popleft()
            node = current_path[-1]
            
            if node == target:
                found_path = current_path
                break
                
            for neighbor in graph.get(node, []):
                if neighbor not in visited:
                    visited.add(neighbor)
                    new_path = list(current_path)
                    new_path.append(neighbor)
                    queue.append(new_path)
        
        if found_path:
            total_path.update(found_path)
    
    # Return sorted or logical order? For SQL joins, order matters less than set of tables
    # But let's return a list in a "discovery" order
    return list(total_path)