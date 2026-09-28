// Written out rather than composed: Tailwind only generates an arbitrary value
// it can see whole in the source.
export const PROJECT_GRID =
  "grid w-full grid-cols-[repeat(auto-fill,minmax(13rem,15rem))] gap-4";

/**
 * One row, whatever the width. Laying out by column means a card that does not
 * fit has nowhere to wrap to, so the row is cut off rather than spilling into a
 * second one — which is what a wrapping grid did, clipped by a fixed height
 * that had to be kept equal to the card's own and was not, leaving the
 * overflowing cards drawn on top of the first row.
 *
 * The height comes from the cards, so there is no second number to keep in step.
 */
export const PROJECT_GRID_ONE_ROW =
  "grid w-full grid-flow-col auto-cols-[minmax(13rem,15rem)] gap-4 overflow-hidden";
