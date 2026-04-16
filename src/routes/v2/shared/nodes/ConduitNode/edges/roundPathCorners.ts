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

function adjustCommand(cmd: Command, newPoint: Point): void {
  if (cmd.length > 2) {
    cmd[cmd.length - 2] = newPoint.x;
    cmd[cmd.length - 1] = newPoint.y;
  }
}

function pointForCommand(cmd: Command): Point {
  return {
    x: Number(cmd[cmd.length - 2]),
    y: Number(cmd[cmd.length - 1]),
  };
}

function isRoundingCandidate(
  prevCmd: Command | undefined,
  curCmd: Command,
  nextCmd: Command | undefined,
): boolean {
  return (
    !!nextCmd &&
    !!prevCmd &&
    prevCmd.length > 2 &&
    String(curCmd[0]) === "L" &&
    nextCmd.length > 2 &&
    String(nextCmd[0]) === "L"
  );
}

function roundCorner(
  prevCmd: Command,
  curCmd: Command,
  nextCmd: Command,
  radius: number,
  useFractionalRadius: boolean,
): Command[] {
  const prevPoint = pointForCommand(prevCmd);
  const curPoint = pointForCommand(curCmd);
  const nextPoint = pointForCommand(nextCmd);

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

  adjustCommand(curCmd, curveStart);
  curCmd.origPoint = curPoint;

  const startControl = moveTowardsFractional(curveStart, curPoint, 0.5);
  const endControl = moveTowardsFractional(curPoint, curveEnd, 0.5);

  const curveCmd = [
    "C",
    startControl.x,
    startControl.y,
    endControl.x,
    endControl.y,
    curveEnd.x,
    curveEnd.y,
  ] as Command;
  curveCmd.origPoint = curPoint;

  return [curCmd, curveCmd];
}

function parsePathCommands(pathString: string): Command[] {
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

  return pathParts.reduce<Command[]>((cmds, part) => {
    const num = Number(part);
    if (!Number.isNaN(num) && cmds.length) {
      cmds[cmds.length - 1].push(num);
    } else {
      cmds.push([part] as Command);
    }
    return cmds;
  }, []);
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
  const commands = parsePathCommands(pathString);

  if (commands.length <= 1) {
    return commands.reduce((str, c) => str + c.join(" ") + " ", "");
  }

  const startPoint = pointForCommand(commands[0]);

  let virtualCloseLine: Command | null = null;
  if (commands[commands.length - 1][0] === "Z" && commands[0].length > 2) {
    virtualCloseLine = ["L", startPoint.x, startPoint.y] as Command;
    commands[commands.length - 1] = virtualCloseLine;
  }

  const resultCommands: Command[] = [commands[0]];

  for (let cmdIndex = 1; cmdIndex < commands.length; cmdIndex++) {
    const prevCmd = resultCommands[resultCommands.length - 1];
    const curCmd = commands[cmdIndex];
    const nextCmd: Command | undefined =
      curCmd === virtualCloseLine ? commands[1] : commands[cmdIndex + 1];

    if (isRoundingCandidate(prevCmd, curCmd, nextCmd)) {
      resultCommands.push(
        ...roundCorner(prevCmd, curCmd, nextCmd!, radius, useFractionalRadius),
      );
    } else {
      resultCommands.push(curCmd);
    }
  }

  if (virtualCloseLine) {
    const newStartPoint = pointForCommand(
      resultCommands[resultCommands.length - 1],
    );
    resultCommands.push(["Z"] as Command);
    adjustCommand(resultCommands[0], newStartPoint);
  }

  return resultCommands.reduce((str, c) => str + c.join(" ") + " ", "");
}
