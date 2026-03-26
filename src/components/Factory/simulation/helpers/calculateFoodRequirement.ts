/**
 * Calculate food required for survival
 * Day 1: 0
 * Day N: (Day N-1 amount * 1.025) + 1
 */

const BASE_REQUIREMENT = 0;
const SCALE_FACTOR = 1.025;

export const calculateFoodRequirement = (
  day: number,
  previousRequirement?: number,
): number => {
  if (day <= 0) return BASE_REQUIREMENT;

  // If we have the previous day's requirement, use it
  if (previousRequirement !== undefined) {
    return Math.round(previousRequirement * SCALE_FACTOR + 1);
  }

  // Fallback: calculate from scratch (only needed if stats are missing)
  let requirement = BASE_REQUIREMENT;
  for (let i = 2; i <= day; i++) {
    requirement = requirement * SCALE_FACTOR + 1;
  }

  return Math.round(requirement);
};
