/**
 * Calculate the refund amount for selling a building.
 * 100% refund on the day built, decreasing 5% per day to a floor of 50% at day 10+.
 */
export function calculateRefund(
  cost: number,
  builtOnDay: number,
  currentDay: number,
): number {
  const daysOwned = currentDay - builtOnDay;
  const depreciation = Math.min(daysOwned * 5, 50);
  const refundPercent = 100 - depreciation;
  return Math.floor((cost * refundPercent) / 100);
}
