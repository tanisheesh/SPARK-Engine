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
        <div className="bg-[#0f172a] border border-orange-500/40 rounded-lg overflow-hidden min-w-[220px] shadow-xl shadow-orange-500/10">
            {/* Table Header */}
            <div className="bg-gradient-to-r from-orange-500/20 to-purple-500/10 px-3 py-2 border-b border-orange-500/30 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <span className="text-orange-200 font-bold text-sm tracking-wider uppercase">{data.label}</span>
            </div>

            {/* Columns with inferred types */}
            <div className="divide-y divide-slate-800/50">
                {(data.columns || []).map((col: string, i: number) => {
                    const pk = isPK(data.label, col);
                    const fk = isFK(col);
                    const type = inferType(col);
                    return (
                        <div key={i} className={`flex items-center justify-between px-3 py-1.5 text-[11px] font-mono ${pk ? 'bg-yellow-500/5' : 'hover:bg-white/2'}`}>
                            <div className="flex items-center gap-2">
                                {pk ? (
                                    <span className="text-[9px] text-yellow-400 font-black">🔑</span>
                                ) : fk ? (
                                    <span className="text-[9px] text-blue-400 font-black">🔗</span>
                                ) : (
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                                )}
                                <span className={`${pk ? 'text-yellow-300 font-bold' : fk ? 'text-blue-300' : 'text-slate-300'}`}>
                                    {col}
                                </span>
                            </div>
                            <span className="text-slate-500 text-[10px]">{type}</span>
                        </div>
                    );
                })}
            </div>

            {/* Handles on all four sides */}
            <Handle type="target" position={Position.Top}    className="!bg-orange-500 !w-2 !h-2" />
            <Handle type="source" position={Position.Bottom} className="!bg-orange-500 !w-2 !h-2" />
            <Handle type="target" position={Position.Left}   className="!bg-orange-500 !w-2 !h-2" />
            <Handle type="source" position={Position.Right}  className="!bg-orange-500 !w-2 !h-2" />
        </div>
    );
});
