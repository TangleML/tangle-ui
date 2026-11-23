import { GRID_SIZE } from "@/routes/v2/shared/flowCanvasDefaults";

/**
 * Shared vertical rhythm for node ports.
 *
 * The canvas grid-snaps `node.position.y` to {@link GRID_SIZE}, and the conduit
 * router derives an edge's Y from `node.position.y + handleOffsetFromTop`. So
 * for any output port to line up horizontally with any input port, every
 * handle's vertical center (measured from the node's top edge, including its
 * border) must be a multiple of {@link GRID_SIZE}. The constants below keep the
 * port rhythm on that grid.
 */

/** Card outer border width; shifts inner content down and must be absorbed. */
const CARD_BORDER = 2;

/** Fixed detailed-card header height (single-line, truncated title). */
const NODE_HEADER_HEIGHT = 24;

/** Gap between the card header and its content section. */
const CARD_HEADER_CONTENT_GAP = 8;

/** Padding at the top of the card content region. */
const CARD_CONTENT_PADDING = 8;

/** Padding at the top of a port section (inputs / outputs box). */
const PORT_SECTION_PADDING = 8;

/**
 * Height of a single port row (label chip). A multiple of `2 * GRID_SIZE` so
 * the row's vertical center lands on the grid.
 */
export const PORT_ROW_HEIGHT = 2 * GRID_SIZE; // 20

/** Vertical gap between consecutive port rows (keeps the row pitch on-grid). */
export const PORT_ROW_GAP = GRID_SIZE; // 10

/**
 * Offset from a node's top edge (including its border) to the vertical center
 * of the first port row. A multiple of {@link GRID_SIZE}, so any output row can
 * be aligned with any input row by grid-snapping node positions.
 */
export const FIRST_PORT_ROW_CENTER =
  CARD_BORDER +
  NODE_HEADER_HEIGHT +
  CARD_HEADER_CONTENT_GAP +
  CARD_CONTENT_PADDING +
  PORT_SECTION_PADDING +
  PORT_ROW_HEIGHT / 2; // 60

/**
 * Shared height for simplified (zoomed-out) node cards. Detailed and simplified
 * views never coexist (a single global zoom threshold switches all nodes at
 * once), so simplified ports only need to align with each other: every
 * simplified node shares this height and pins its handle at 50%.
 */
export const SIMPLIFIED_NODE_HEIGHT = 10 * GRID_SIZE; // 100
