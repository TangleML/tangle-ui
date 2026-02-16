/**
 * Calculate the angle of a cubic Bezier curve at t=0.5 (midpoint)
 * Bezier formula: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
 * Derivative: B'(t) = 3(1-t)²(P1-P0) + 6(1-t)t(P2-P1) + 3t²(P3-P2)
 */
export const getBezierMidpointAngle = (
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: string,
  targetPosition: string,
): number => {
  // Calculate control points (ReactFlow's default Bezier calculation)
  const curvature = 0.25;
  const offsetX = Math.abs(targetX - sourceX) * curvature;
  const offsetY = Math.abs(targetY - sourceY) * curvature;

  let controlPoint1X = sourceX;
  let controlPoint1Y = sourceY;
  let controlPoint2X = targetX;
  let controlPoint2Y = targetY;

  // Adjust control points based on handle positions
  if (sourcePosition === "right") controlPoint1X += offsetX;
  else if (sourcePosition === "left") controlPoint1X -= offsetX;
  else if (sourcePosition === "bottom") controlPoint1Y += offsetY;
  else if (sourcePosition === "top") controlPoint1Y -= offsetY;

  if (targetPosition === "left") controlPoint2X -= offsetX;
  else if (targetPosition === "right") controlPoint2X += offsetX;
  else if (targetPosition === "top") controlPoint2Y -= offsetY;
  else if (targetPosition === "bottom") controlPoint2Y += offsetY;

  // Calculate derivative at t=0.5 (midpoint)
  const t = 0.5;
  const oneMinusT = 1 - t;

  // B'(t) at t=0.5
  const dx =
    3 * oneMinusT * oneMinusT * (controlPoint1X - sourceX) +
    6 * oneMinusT * t * (controlPoint2X - controlPoint1X) +
    3 * t * t * (targetX - controlPoint2X);

  const dy =
    3 * oneMinusT * oneMinusT * (controlPoint1Y - sourceY) +
    6 * oneMinusT * t * (controlPoint2Y - controlPoint1Y) +
    3 * t * t * (targetY - controlPoint2Y);

  // Calculate angle from derivative
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  // Normalize to keep text readable
  if (angle > 90 || angle < -90) {
    return angle + 180;
  }

  return angle;
};
