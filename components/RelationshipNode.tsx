import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

export default memo(({ data }: any) => {
  const isIdentifying = data.isIdentifying;

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      {/* The Diamond Shape */}
      <div
        className={`absolute inset-0 flex rotate-45 items-center justify-center border ${
          isIdentifying ? 'border-accent bg-transparent' : 'border-line bg-surface2'
        }`}
      >
        {/* A double outline is the notation for an identifying relationship. */}
        {isIdentifying ? (
          <div className="h-[85%] w-[85%] border border-accent bg-transparent" />
        ) : null}
      </div>

      <span className="relative z-10 rotate-0 px-1 text-center font-mono text-[10px] leading-tight text-muted">
        {data.label}
      </span>

      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
});
