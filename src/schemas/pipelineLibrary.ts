import { z } from "zod";

export const PipelineLibrarySchema = z.object({
  components: z.array(
    z.looseObject({
      name: z.string(),
      url: z.string(),
    }),
  ),
});

export type PipelineLibrary = z.infer<typeof PipelineLibrarySchema>;
