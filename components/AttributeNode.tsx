import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

export default memo(({ data }: any) => {
  const isPK = data.isPK;
  const isMulti = data.isMulti;
  const isDerived = data.isDerived;

  return (
    <div className={`
      relative flex items-center justify-center bg-surface2 text-muted font-mono text-xs text-center min-w-[80px] min-h-[40px] rounded-[50%]
      ${isPK ? 'border border-line' : (isMulti ? 'p-[3px] border border-line' : 'border border-line')}
      ${isDerived ? 'border-dashed border-line' : ''}
    `}>
      {isMulti ? (
        <div className="w-full h-full flex items-center justify-center rounded-[50%] border border-line bg-surface2 px-3 py-1">
          <span className={isPK ? 'underline decoration-accent' : ''}>{data.label}</span>
        </div>
      ) : (
        <span className={isPK ? 'underline decoration-accent px-4 py-2' : 'px-4 py-2'}>{data.label}</span>
      )}
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
});
