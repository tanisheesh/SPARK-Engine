"use client";

import React, { useCallback, useState } from "react";
import { EdgeProps } from "reactflow";

/**
 * Custom edge with a draggable midpoint waypoint (Excalidraw-style).
 * Users can drag the control point to reshape the curve.
 */
export default function WaypointEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  label,
  labelStyle,
  markerEnd,
  selected,
  data,
}: EdgeProps) {
  // Control point offset from the natural midpoint
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const midX = (sourceX + targetX) / 2 + offset.x;
  const midY = (sourceY + targetY) / 2 + offset.y;

  // Build a quadratic bezier path through the control point
  const path = `M ${sourceX} ${sourceY} Q ${midX} ${midY} ${targetX} ${targetY}`;

  // Label position at the control point
  const labelX = midX;
  const labelY = midY - 14;

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startOffset = { ...offset };

    const onMouseMove = (ev: MouseEvent) => {
      setOffset({
        x: startOffset.x + (ev.clientX - startX),
        y: startOffset.y + (ev.clientY - startY),
      });
    };

    const onMouseUp = () => {
      setDragging(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [offset]);

  return (
    <>
      {/* Invisible wider path for easier click targeting */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: "pointer" }}
      />
      {/* Visible path */}
      <path
        d={path}
        fill="none"
        stroke={selected ? "#f59e0b" : (style?.stroke as string) || "#facc15"}
        strokeWidth={selected ? 3 : (style?.strokeWidth as number) || 2}
        markerEnd={markerEnd as string}
        style={{ transition: "stroke 0.2s, stroke-width 0.2s" }}
      />

      {/* Draggable waypoint circles */}
      {/* Start anchor */}
      <circle
        cx={sourceX}
        cy={sourceY}
        r={3}
        fill="#64748b"
        className="pointer-events-none"
      />
      {/* End anchor */}
      <circle
        cx={targetX}
        cy={targetY}
        r={3}
        fill="#64748b"
        className="pointer-events-none"
      />
      {/* Draggable midpoint */}
      <circle
        cx={midX}
        cy={midY}
        r={dragging ? 7 : 5}
        fill={dragging ? "#f59e0b" : "#facc15"}
        stroke="#0f172a"
        strokeWidth={2}
        style={{
          cursor: "grab",
          filter: dragging ? "drop-shadow(0 0 8px rgba(250,204,21,0.6))" : "none",
          transition: "r 0.15s, fill 0.15s",
        }}
        onMouseDown={onMouseDown}
      />

      {/* Edge label */}
      {label && (
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fill: (labelStyle as any)?.fill || "#facc15",
            fontWeight: (labelStyle as any)?.fontWeight || "900",
            fontSize: (labelStyle as any)?.fontSize || 12,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          {String(label)}
        </text>
      )}
    </>
  );
}
