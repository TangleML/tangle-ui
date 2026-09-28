export type ComponentMatchStrength = "strong" | "partial" | "related" | "weak";

export function getComponentMatchStrength(
  score: number,
  strength?: ComponentMatchStrength,
): ComponentMatchStrength {
  if (strength) return strength;
  // Providers without a rubric category use the nearest normalized grade.
  if (score >= 5 / 6) return "strong";
  if (score >= 1 / 2) return "partial";
  if (score >= 1 / 6) return "related";
  return "weak";
}

export function getComponentSearchRankingNotice(
  strengths: readonly (ComponentMatchStrength | undefined)[],
): string | undefined {
  if (strengths.includes("strong")) return undefined;
  if (strengths.includes("partial"))
    return "No direct matches—showing partial matches.";
  if (strengths.includes("related"))
    return "No direct matches—showing related components.";
  if (strengths.includes("weak"))
    return "No clear matches—showing the closest available components.";
  return undefined;
}
