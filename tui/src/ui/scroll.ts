export function maxScrollOffset(
  contentHeight: number,
  viewportHeight: number,
): number {
  return Math.max(0, contentHeight - viewportHeight);
}

export function clampScrollOffset(
  offset: number,
  contentHeight: number,
  viewportHeight: number,
): number {
  const max = maxScrollOffset(contentHeight, viewportHeight);
  if (offset < 0) return 0;
  if (offset > max) return max;
  return offset;
}

export function topOffsetFromBottom(
  offset: number,
  contentHeight: number,
  viewportHeight: number,
): number {
  const max = maxScrollOffset(contentHeight, viewportHeight);
  return max - clampScrollOffset(offset, contentHeight, viewportHeight);
}
