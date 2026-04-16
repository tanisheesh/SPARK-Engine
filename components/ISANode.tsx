import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

export default memo(({ data }: any) => {
  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      {/* Triangle / ISA Shape */}
      <div 
        className="absolute inset-0 bg-red-500" 
        style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} 
      />
      
      <span className="relative z-10 text-[10px] font-black text-white text-center mt-4">
        ISA
      </span>

      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});
