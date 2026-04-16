import {
  type ConnectionLineComponentProps,
  getBezierPath,
  useNodes,
} from "@xyflow/react";

export function ConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
}: ConnectionLineComponentProps) {
  const hasGhost = useNodes().some((n) => n.type === "ghost");
  if (hasGhost) return null;

  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  });

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke="#b1b1b7"
        strokeWidth={1.5}
        className="animated"
      />
    </g>
  );
}
