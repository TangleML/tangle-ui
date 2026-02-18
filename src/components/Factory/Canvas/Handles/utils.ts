import { Position } from "@xyflow/react";

export const layoutHandleAtPosition = ({
  position,
  groupIndex,
  totalInGroup,
}: {
  position: Position;
  groupIndex: number;
  totalInGroup: number;
}) => {
  if (totalInGroup === 1) {
    return {};
  }

  const spacing = 100 / (totalInGroup + 1);
  const offset = spacing * (groupIndex + 1);

  switch (position) {
    case Position.Top:
    case Position.Bottom:
      return { left: `${offset}%` };
    case Position.Left:
    case Position.Right:
      return { top: `${offset}%` };
    default:
      return {};
  }
};
