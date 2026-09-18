export const PROJECT_COLORS = [
  "violet",
  "blue",
  "cyan",
  "emerald",
  "amber",
  "rose",
] as const;

export type ProjectColor = (typeof PROJECT_COLORS)[number];

export const projectColorStyles: Record<
  ProjectColor,
  { label: string; accent: string; text: string }
> = {
  violet: { label: "Violet", accent: "bg-violet-500", text: "text-violet-500" },
  blue: { label: "Blue", accent: "bg-blue-500", text: "text-blue-500" },
  cyan: { label: "Cyan", accent: "bg-cyan-500", text: "text-cyan-500" },
  emerald: {
    label: "Emerald",
    accent: "bg-emerald-500",
    text: "text-emerald-500",
  },
  amber: { label: "Amber", accent: "bg-amber-500", text: "text-amber-500" },
  rose: { label: "Rose", accent: "bg-rose-500", text: "text-rose-500" },
};

export function isProjectColor(value: unknown): value is ProjectColor {
  return (
    typeof value === "string" &&
    (PROJECT_COLORS as readonly string[]).includes(value)
  );
}
