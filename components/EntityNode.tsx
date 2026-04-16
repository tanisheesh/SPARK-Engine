import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

export default memo(({ data }: any) => {
  const isWeak = data.isWeak;
  
  return (
    <div className={`relative flex items-center justify-center bg-slate-900 text-white font-bold text-center min-w-[120px] min-h-[50px] ${isWeak ? 'p-1 border border-orange-500' : 'px-4 py-2 border-2 border-orange-500'}`}>
      {isWeak ? (
        <div className="w-full h-full flex items-center justify-center border border-orange-500 bg-slate-900 px-3 py-1">
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
