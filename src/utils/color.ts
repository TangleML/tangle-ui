/**
 * Returns "#000000" or "#FFFFFF" depending on which provides better contrast
 * against the given background color. Uses WCAG relative luminance formula.
 */
export function getContrastTextColor(hex: string): string {
  const rgb = parseHexToRgb(hex);
  if (!rgb) return "#000000";

  const luminance = relativeLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > 0.179 ? "#000000" : "#FFFFFF";
}

function parseHexToRgb(
  hex: string,
): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace("#", "");
  if (cleaned.length === 3) {
    return {
      r: parseInt(cleaned[0] + cleaned[0], 16),
      g: parseInt(cleaned[1] + cleaned[1], 16),
      b: parseInt(cleaned[2] + cleaned[2], 16),
    };
  }
  if (cleaned.length === 6) {
    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16),
    };
  }
  return null;
}

function linearize(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}
