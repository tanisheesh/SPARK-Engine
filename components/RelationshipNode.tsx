import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

export default memo(({ data }: any) => {
  const isIdentifying = data.isIdentifying;

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      {/* The Diamond Shape */}
      <div className={`absolute inset-0 rotate-45 border shadow-lg flex items-center justify-center ${isIdentifying ? 'bg-transparent border-yellow-500 border-2' : 'bg-yellow-400 border-yellow-600 shadow-yellow-900/20'}`}>
         {isIdentifying ? (
            <div className="w-[85%] h-[85%] bg-yellow-400 border border-yellow-600 flex items-center justify-center" />
         ) : null}
      </div>
      
      <span className="relative z-10 text-[10px] font-black text-black text-center uppercase leading-tight px-1 rotate-0">
        {data.label}
      </span>

      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
});
