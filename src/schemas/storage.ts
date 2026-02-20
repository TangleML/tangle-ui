import { z } from "zod";

/** Schema for drag-and-drop offset data */
export const DragStartOffsetSchema = z.object({
  offsetX: z.number(),
  offsetY: z.number(),
});
