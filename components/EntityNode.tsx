import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

export default memo(({ data }: any) => {
  const isWeak = data.isWeak;
  
  return (
    <div className={`relative flex items-center justify-center bg-surface2 text-ink font-mono text-sm text-center min-w-[120px] min-h-[50px] ${isWeak ? 'p-1 border border-line' : 'px-4 py-2 border border-line'}`}>
      {isWeak ? (
        <div className="w-full h-full flex items-center justify-center border border-line bg-surface2 px-3 py-1">
          {data.label}
        </div>
      ) : (
        data.label
      )}
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
});
