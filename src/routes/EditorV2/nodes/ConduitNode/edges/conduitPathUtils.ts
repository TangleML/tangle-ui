import type { XYPosition } from "@xyflow/react";
import { Position } from "@xyflow/react";

import {
  buildOrthogonalPolyline,
  removeCollinearPoints,
} from "./orthogonalPolyline";

const INTERNAL_SPACING = 4;

export interface ConduitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Orientation = "horizontal" | "vertical";

const nolog = (..._args: unknown[]) => {};
let log = nolog;

export interface ConduitEdgePathParams {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
  conduits: ConduitRect[];
  bundleIndex: number;
  bundleTotal: number;
  options?: {
    isSelected?: boolean;
  };
}

export interface DebugPoint {
  point: XYPosition;
  type: "entry" | "exit" | "path";
  conduitIndex: number;
}

export interface ConduitPathResult {
  path: string;
  debugPoints: DebugPoint[];
}

export function getOrientation(rect: ConduitRect): Orientation {
  return rect.width >= rect.height ? "horizontal" : "vertical";
}

function bundleOffset(bundleIndex: number, _bundleTotal: number): number {
  return bundleIndex /*- (bundleTotal - 1) / 2*/ * INTERNAL_SPACING;
}

function bundleRectOffset(
  rect: ConduitRect,
  bundleIndex: number,
  bundleTotal: number,
): number {
  const orientation = getOrientation(rect);
  const availableSpace =
    orientation === "horizontal" ? rect.height : rect.width;
  const spacing = (availableSpace - bundleTotal * 2) / bundleTotal;

  log(
    `bundleRectOffset(${bundleIndex}, ${bundleTotal}, ${orientation}) = ${spacing}; rect=${JSON.stringify(rect)}; index=${bundleIndex}; offset=${bundleIndex * spacing}`,
  );

  return bundleIndex * spacing;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Find the closest point on the border of `rect` to `target`, considering
 * all 4 edges. Then apply `tangentOffset` along the edge the point lands on.
 *
 * For an external target: clamp gives the nearest border point directly.
 * For a target inside the rect: project outward to the nearest edge.
 */
function closestPointOnRect(
  rect: ConduitRect,
  target: XYPosition,
  tangentOffset: number,
): XYPosition {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  let cx = clamp(target.x, left, right);
  let cy = clamp(target.y, top, bottom);

  const isInside = cx > left && cx < right && cy > top && cy < bottom;

  if (isInside) {
    const dLeft = cx - left;
    const dRight = right - cx;
    const dTop = cy - top;
    const dBottom = bottom - cy;
    const minDist = Math.min(dLeft, dRight, dTop, dBottom);

    if (minDist === dLeft) cx = left;
    else if (minDist === dRight) cx = right;
    else if (minDist === dTop) cy = top;
    else cy = bottom;
  }

  const side = pointSide(rect, { x: cx, y: cy });
  return applyTangentOffset(rect, { x: cx, y: cy }, side, tangentOffset);
}

/**
 * Determine which side of the rect a border point is on.
 */
function pointSide(rect: ConduitRect, point: XYPosition): Position {
  const eps = 0.5;
  if (Math.abs(point.x - rect.x) < eps) return Position.Left;
  if (Math.abs(point.x - (rect.x + rect.width)) < eps) return Position.Right;
  if (Math.abs(point.y - rect.y) < eps) return Position.Top;
  return Position.Bottom;
}

/**
 * Shift a border point along the edge it lies on, clamped to stay on that edge.
 */
function applyTangentOffset(
  rect: ConduitRect,
  point: XYPosition,
  side: Position,
  offset: number,
): XYPosition {
  if (offset === 0) return point;

  switch (side) {
    case Position.Top:
    case Position.Bottom:
      return {
        x: clamp(point.x + offset, rect.x, rect.x + rect.width),
        y: point.y,
      };
    case Position.Left:
    case Position.Right:
      return {
        x: point.x,
        y: clamp(point.y + offset, rect.y, rect.y + rect.height),
      };
  }
}

function handleOffsetVector(position: Position, magnitude: number): XYPosition {
  switch (position) {
    case Position.Right:
      return { x: magnitude, y: 0 };
    case Position.Left:
      return { x: -magnitude, y: 0 };
    case Position.Bottom:
      return { x: 0, y: magnitude };
    case Position.Top:
      return { x: 0, y: -magnitude };
  }
}

function applyOrientationOffset(
  position: XYPosition,
  offset: number,
  rect: ConduitRect,
): XYPosition {
  // todo: optimize DRY violation
  const orientation = getOrientation(rect);

  if (orientation === "horizontal") {
    const limit = rect.y + rect.height;
    return {
      x: position.x,
      y: position.y + (limit > position.y + offset ? 1 : -1) * offset,
    };
  }

  const limit = rect.x + rect.width;
  return {
    x: position.x + (limit > position.x + offset ? 1 : -1) * offset,
    y: position.y,
  };
}

function alignPointToHandle(
  position: XYPosition,
  handle: XYPosition,
  orientation: Orientation,
  eps: number = 30,
): XYPosition {
  if (!handle) {
    return position;
  }

  return {
    x: Math.abs(position.x - handle.x) < eps ? handle.x : position.x,
    y: Math.abs(position.y - handle.y) < eps ? handle.y : position.y,
  };
}

function alignPointToLine(
  position: XYPosition,
  linePoint: XYPosition,
  orientation: Orientation,
): XYPosition {
  return {
    x: orientation === "vertical" ? linePoint.x : position.x,
    y: orientation === "horizontal" ? linePoint.y : position.y,
  };
}

export function buildConduitPath({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  conduits,
  bundleIndex,
  bundleTotal,
  options,
}: ConduitEdgePathParams): ConduitPathResult {
  if (conduits.length === 0) {
    return {
      path: fallbackBezier(
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      ),
      debugPoints: [],
    };
  }

  const isSelected = options?.isSelected ?? false;
  log = isSelected ? console.log : nolog;

  log(
    `%c Logging entries and exits for conduit wires index=${bundleIndex}, bundleTotal=${bundleTotal}; target=${targetX},${targetY} on ${JSON.stringify(targetPosition)}:`,
    "border: 1px solid red; padding: 10px;",
    conduits,
  );

  const handleXOffset = 8;
  const sourceXY: XYPosition = { x: sourceX, y: sourceY };
  // this shift is for UX purposes to make the handle more visible
  const sourceHandleXY: XYPosition = {
    x: sourceX + handleXOffset,
    y: sourceY,
  };
  const targetXY: XYPosition = { x: targetX - handleXOffset, y: targetY };
  const targetHandleXY: XYPosition = {
    x: targetX + handleXOffset,
    y: targetY,
  };
  const offset = bundleOffset(bundleIndex, bundleTotal);

  const entries: XYPosition[] = [];
  const exits: XYPosition[] = [];

  for (let i = 0; i < conduits.length; i++) {
    const rect = conduits[i];

    const bundleOffset_0 = bundleRectOffset(rect, bundleIndex, bundleTotal);
    const entryTarget = i === 0 ? sourceHandleXY : exits[i - 1];
    const entry = closestPointOnRect(rect, entryTarget, offset);

    const conduitOrientation = getOrientation(rect);
    entries.push(applyOrientationOffset(entry, bundleOffset_0, rect));

    if (i < conduits.length - 1) {
      const nextRect = conduits[i + 1];
      let exitCandidate = closestPointOnRect(
        rect,
        rectCenter(nextRect),
        offset,
      );
      const nextEntry = closestPointOnRect(nextRect, exitCandidate, offset);
      exitCandidate = closestPointOnRect(rect, nextEntry, 0);
      exits.push(
        exitCandidate,
        // applyOrientationOffset(exitCandidate, bundleOffset_0, rect),
      );

      log(
        `exitCandidate=${JSON.stringify(exitCandidate)}, exits[${exits.length - 1}]=${JSON.stringify(exits[exits.length - 1])}; conduitOrientation=${conduitOrientation}; bundleOffset_0=${bundleOffset_0}; condtuitIndex=${i}`,
      );
    } else {
      const exit = closestPointOnRect(rect, targetXY, offset);

      exits.push(
        alignPointToHandle(exit, targetXY, conduitOrientation, 50),
        // applyOrientationOffset(exit, bundleOffset_0, conduitOrientation),
      );
    }
  }

  log("entries", entries);
  log("exits", exits);

  const pathPoints: XYPosition[] = [sourceXY, sourceHandleXY, entries[0]];

  //d += handleToConduitAngled(sourceXY, entries[0]);
  // const bundleOffset_0 = bundleRectOffset(
  //   conduits[0],
  //   bundleIndex,
  //   bundleTotal,
  // );
  //d += internalPath(conduits[0], entries[0], exits[0], bundleOffset_0);

  pathPoints.push(...getInternalPathPoints(conduits[0], entries[0], exits[0]));

  for (let i = 0; i < exits.length; i++) {
    exits[i] = alignPointToLine(
      exits[i],
      entries[i],
      getOrientation(conduits[i]),
    );
  }

  for (let i = 1; i < conduits.length; i++) {
    const orientation = getOrientation(conduits[i]);
    // const bundleOffset_i = bundleRectOffset(
    //   conduits[i],
    //   bundleIndex,
    //   bundleTotal,
    // );
    //d += conduitToConduitAngled(exits[i - 1], entries[i]);
    pathPoints.push(
      exits[i - 1],
      alignPointToHandle(entries[i], exits[i - 1], orientation, 50),
    );

    // d += internalPath(conduits[i], entries[i], exits[i], bundleOffset_i);
    pathPoints.push(
      ...getInternalPathPoints(
        conduits[i],
        entries[i],
        exits[i],
        // alignPointToLine(exits[i], entries[i], orientation),
      ),
    );
  }

  //d += conduitToHandleAngled(exits[exits.length - 1], targetXY);
  pathPoints.push(pathPoints[pathPoints.length - 1], targetXY, targetHandleXY);

  // for (let i = 0; i < conduits.length; i++) {
  //   debugPoints.push({ point: entries[i], type: "entry", conduitIndex: i });
  //   debugPoints.push({ point: exits[i], type: "exit", conduitIndex: i });
  // }

  /**
   * Build optimized orthogonal polyline with round corners.
   */
  const path = removeCollinearPoints(buildOrthogonalPolyline(pathPoints));

  const debugPoints: DebugPoint[] = [
    // ...conduits.map((rect, i) => ({
    //   point: entries[i],
    //   type: "entry",
    //   conduitIndex: i,
    // })),
    // ...conduits.map((rect, i) => ({
    //   point: exits[i],
    //   type: "exit",
    //   conduitIndex: i,
    // })),
    // ...path.map((point, index) => ({
    //   point,
    //   type: "path" as const,
    //   // index < pathPoints.length - 1 ? ("entry" as const) : ("exit" as const),
    //   conduitIndex: index,
    // })),
  ];

  const pathString = roundPathCorners(
    linePath({ ...pathPoints[0], startPath: true }, ...path.slice(1)),
    4,
    false,
  );

  return { path: pathString, debugPoints };
}

function getInternalPathPoints(
  rect: ConduitRect,
  entry: XYPosition,
  exit: XYPosition,
): XYPosition[] {
  const orientation = getOrientation(rect);

  const intExit: XYPosition =
    orientation === "horizontal"
      ? { x: exit.x, y: entry.y }
      : { x: entry.x, y: exit.y };

  return [intExit, exit];
}

function rectCenter(rect: ConduitRect): XYPosition {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

function linePath(
  ...points: Array<XYPosition & { startPath?: boolean }>
): string {
  return points
    .map((point) => ` ${point.startPath ? "M" : "L"}${point.x},${point.y}`)
    .join("");
}

function fallbackBezier(
  sourceX: number,
  sourceY: number,
  sourcePosition: Position,
  targetX: number,
  targetY: number,
  targetPosition: Position,
): string {
  const dist = Math.hypot(targetX - sourceX, targetY - sourceY);
  const offset = Math.max(dist * 0.25, 30);

  const h1 = handleOffsetVector(sourcePosition, offset);
  const h2 = handleOffsetVector(targetPosition, offset);

  return `M${sourceX},${sourceY} C${sourceX + h1.x},${sourceY + h1.y} ${targetX + h2.x},${targetY + h2.y} ${targetX},${targetY}`;
}

/**
 * SVG Path rounding function. Takes an input path string and outputs a path
 * string where all line-line corners have been rounded. Only supports absolute
 * commands at the moment.
 *
 * @param pathString The SVG input path
 * @param radius The amount to round the corners, either a value in the SVG
 *               coordinate space, or, if useFractionalRadius is true, a value
 *               from 0 to 1.
 * @param useFractionalRadius If true, the curve radius is expressed as a
 *               fraction of the distance between the point being curved and
 *               the previous and next points.
 * @returns A new SVG path string with the rounding
 */
export function roundPathCorners(
  pathString: string,
  radius: number,
  useFractionalRadius: boolean,
): string {
  type Point = { x: number; y: number };
  type Command = Array<string | number> & { origPoint?: Point };

  function moveTowardsLength(
    movingPoint: Point,
    targetPoint: Point,
    amount: number,
  ): Point {
    const width = targetPoint.x - movingPoint.x;
    const height = targetPoint.y - movingPoint.y;
    const distance = Math.sqrt(width * width + height * height);
    return moveTowardsFractional(
      movingPoint,
      targetPoint,
      Math.min(1, amount / distance),
    );
  }

  function moveTowardsFractional(
    movingPoint: Point,
    targetPoint: Point,
    fraction: number,
  ): Point {
    return {
      x: movingPoint.x + (targetPoint.x - movingPoint.x) * fraction,
      y: movingPoint.y + (targetPoint.y - movingPoint.y) * fraction,
    };
  }

  // Adjusts the ending position of a command
  function adjustCommand(cmd: Command, newPoint: Point): void {
    if (cmd.length > 2) {
      cmd[cmd.length - 2] = newPoint.x;
      cmd[cmd.length - 1] = newPoint.y;
    }
  }

  // Gives an {x, y} object for a command's ending position
  function pointForCommand(cmd: Command): Point {
    return {
      x: Number(cmd[cmd.length - 2]),
      y: Number(cmd[cmd.length - 1]),
    };
  }

  // Split apart the path, handling concatenated letters and numbers
  const pathParts = pathString
    .split(/[,\s]/)
    .reduce<string[]>((parts, part) => {
      const match = part.match(/([a-zA-Z])(.+)/);
      if (match) {
        parts.push(match[1]);
        parts.push(match[2]);
      } else {
        parts.push(part);
      }
      return parts;
    }, []);

  // Group the commands with their arguments for easier handling
  const commands = pathParts.reduce<Command[]>((cmds, part) => {
    const num = Number(part);
    if (!Number.isNaN(num) && cmds.length) {
      cmds[cmds.length - 1].push(num);
    } else {
      cmds.push([part] as Command);
    }
    return cmds;
  }, []);

  // The resulting commands, also grouped
  let resultCommands: Command[] = [];

  if (commands.length > 1) {
    const startPoint = pointForCommand(commands[0]);

    // Handle the close path case with a "virtual" closing line
    let virtualCloseLine: Command | null = null;
    if (commands[commands.length - 1][0] === "Z" && commands[0].length > 2) {
      virtualCloseLine = ["L", startPoint.x, startPoint.y] as Command;
      commands[commands.length - 1] = virtualCloseLine;
    }

    // We always use the first command (but it may be mutated)
    resultCommands.push(commands[0]);

    for (let cmdIndex = 1; cmdIndex < commands.length; cmdIndex++) {
      const prevCmd = resultCommands[resultCommands.length - 1];
      const curCmd = commands[cmdIndex];

      // Handle closing case
      const nextCmd: Command | undefined =
        curCmd === virtualCloseLine ? commands[1] : commands[cmdIndex + 1];

      // Nasty logic to decide if this path is a candidate.
      if (
        nextCmd &&
        prevCmd &&
        prevCmd.length > 2 &&
        String(curCmd[0]) === "L" &&
        nextCmd.length > 2 &&
        String(nextCmd[0]) === "L"
      ) {
        // Calc the points we're dealing with
        const prevPoint = pointForCommand(prevCmd);
        const curPoint = pointForCommand(curCmd);
        const nextPoint = pointForCommand(nextCmd);

        // The start and end of the curve are just our point moved towards the previous and next points, respectively
        let curveStart: Point;
        let curveEnd: Point;

        if (useFractionalRadius) {
          curveStart = moveTowardsFractional(
            curPoint,
            prevCmd.origPoint || prevPoint,
            radius,
          );
          curveEnd = moveTowardsFractional(
            curPoint,
            nextCmd.origPoint || nextPoint,
            radius,
          );
        } else {
          curveStart = moveTowardsLength(curPoint, prevPoint, radius);
          curveEnd = moveTowardsLength(curPoint, nextPoint, radius);
        }

        // Adjust the current command and add it
        adjustCommand(curCmd, curveStart);
        (curCmd as Command).origPoint = curPoint;
        resultCommands.push(curCmd);

        // The curve control points are halfway between the start/end of the curve and the original point
        const startControl = moveTowardsFractional(curveStart, curPoint, 0.5);
        const endControl = moveTowardsFractional(curPoint, curveEnd, 0.5);

        // Create the curve
        const curveCmd = [
          "C",
          startControl.x,
          startControl.y,
          endControl.x,
          endControl.y,
          curveEnd.x,
          curveEnd.y,
        ] as Command;
        // Save the original point for fractional calculations
        curveCmd.origPoint = curPoint;
        resultCommands.push(curveCmd);
      } else {
        // Pass through commands that don't qualify
        resultCommands.push(curCmd);
      }
    }

    // Fix up the starting point and restore the close path if the path was originally closed
    if (virtualCloseLine) {
      const newStartPoint = pointForCommand(
        resultCommands[resultCommands.length - 1],
      );
      resultCommands.push(["Z"] as Command);
      adjustCommand(resultCommands[0], newStartPoint);
    }
  } else {
    resultCommands = commands;
  }

  return resultCommands.reduce((str, c) => str + c.join(" ") + " ", "");
}
