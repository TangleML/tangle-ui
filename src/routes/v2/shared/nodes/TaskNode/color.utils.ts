interface TaskColorPalette {
  /** The original selected color */
  background: string;
  /** Darker accent for borders — same hue, higher saturation, lower lightness */
  border: string;
  /** Subtle tinted background for input/output sections */
  sectionBg: string;
  /** WCAG-appropriate text color (black or white) */
  text: string;
}

/**
 * Derives a cohesive color palette from a single base hex color.
 * Returns undefined for transparent/invalid input so callers fall back to defaults.
 */
export function deriveColorPalette(hex: string): TaskColorPalette | undefined {
  if (!hex || hex === "transparent") return undefined;
  const rgb = parseHexToRgb(hex);
  if (!rgb) return undefined;

  const [h, s, l] = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Border: darken by 35% of current lightness, boost saturation slightly
  const borderL = Math.max(l * 0.35, 0.12);
  const borderS = Math.min(s * 1.2, 1);

  // Section background: desaturate and lighten toward white
  const sectionL = Math.min(l + (1 - l) * 0.7, 0.92);
  const sectionS = s * 0.35;

  return {
    background: hex,
    border: hslToHex(h, borderS, borderL),
    sectionBg: hslToHex(h, sectionS, sectionL),
    text: getContrastTextColor(hex),
  };
}

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

function rgbToHsl(
  r: number,
  g: number,
  b: number,
): [h: number, s: number, l: number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }

  const toHex = (c: number) =>
    Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function linearize(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}
