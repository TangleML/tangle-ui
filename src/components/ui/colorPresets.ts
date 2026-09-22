/** Keep this module import-free: the agent worker loads it and must not pull in React. */
export const PRESET_COLORS = [
  "#FFF9C4",
  "#C8E6C9",
  "#BBDEFB",
  "#D1C4E9",
  "#FFE0B2",
  "#EF9A9A",
  "#FFCCBC",
  "#D7CCC8",
  "#F5F5F5",
  "#CFD8DC",
  "#B0BEC5",
  "transparent",
];

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isPickableColor(color: string): boolean {
  return color === "transparent" || HEX_COLOR.test(color);
}
