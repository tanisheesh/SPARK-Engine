import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

// Infer a SQL-like data type from column name heuristics
function inferType(col: string): string {
    const c = col.toLowerCase();
    if (c === 'id' || c.endsWith('_id')) return 'int';
    if (c.includes('email')) return 'varchar';
    if (c.includes('name') || c.includes('title') || c.includes('description') || c.includes('text') || c.includes('content')) return 'text';
    if (c.includes('price') || c.includes('amount') || c.includes('total') || c.includes('cost')) return 'decimal';
    if (c.includes('count') || c.includes('quantity') || c.includes('num') || c.includes('age') || c.includes('score')) return 'int';
    if (c.includes('is_') || c.includes('has_') || c.includes('active') || c.includes('enabled') || c.includes('verified')) return 'boolean';
    if (c.includes('date') || c.includes('_at') || c.includes('time') || c.includes('created') || c.includes('updated')) return 'timestamp';
    if (c.includes('url') || c.includes('image') || c.includes('avatar') || c.includes('photo') || c.includes('link')) return 'varchar';
    if (c.includes('json') || c.includes('data') || c.includes('meta') || c.includes('config')) return 'json';
    if (c.includes('uuid') || c.includes('token') || c.includes('hash') || c.includes('key')) return 'uuid';
    return 'varchar';
}

function isPK(table: string, col: string): boolean {
    return col === 'id' || col === `${table.toLowerCase()}_id` || col === `${table}_id`;
}

function isFK(col: string): boolean {
    return col.endsWith('_id') && col !== 'id';
}

export default memo(({ data }: any) => {
    return (
        <div className="min-w-[212px] overflow-hidden rounded-lg border border-line bg-surface2">
            {/* Table name */}
            <div className="border-b border-line-subtle px-2.5 py-1.5">
                <span className="font-mono text-sm text-ink">{data.label}</span>
            </div>

            {/* Columns. Keys are labelled PK/FK in mono — a legend a DBA
                can read, rather than a pictogram to decode. */}
            <div className="divide-y divide-line-subtle">
                {(data.columns || []).map((col: string, i: number) => {
                    const pk = isPK(data.label, col);
                    const fk = isFK(col);
                    const type = inferType(col);
                    return (
                        <div key={i} className="flex items-center gap-2 px-2.5 py-1 font-mono text-[11px]">
                            <span
                                className={`w-[16px] shrink-0 text-[9px] ${pk ? 'text-accent' : fk ? 'text-info' : 'text-transparent'}`}
                            >
                                {pk ? 'PK' : fk ? 'FK' : '·'}
                            </span>
                            <span className={`min-w-0 flex-1 truncate ${pk ? 'text-ink' : 'text-muted'}`}>
                                {col}
                            </span>
                            <span className="shrink-0 text-[10px] text-faint">{type}</span>
                        </div>
                    );
                })}
            </div>

            {/* Handles on all four sides */}
            <Handle type="target" position={Position.Top}    className="!bg-line !w-1.5 !h-1.5 !border-0" />
            <Handle type="source" position={Position.Bottom} className="!bg-line !w-1.5 !h-1.5 !border-0" />
            <Handle type="target" position={Position.Left}   className="!bg-line !w-1.5 !h-1.5 !border-0" />
            <Handle type="source" position={Position.Right}  className="!bg-line !w-1.5 !h-1.5 !border-0" />
        </div>
    );
});
