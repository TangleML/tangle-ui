import { z } from "zod";

const BaseComponentFolderSchema = z.object({
  name: z.string(),
  components: z.array(z.record(z.string(), z.unknown())).optional(),
  isUserFolder: z.boolean().optional(),
});

type ComponentFolderInput = z.infer<typeof BaseComponentFolderSchema> & {
  folders?: ComponentFolderInput[];
};

const ComponentFolderSchema: z.ZodType<ComponentFolderInput> =
  BaseComponentFolderSchema.extend({
    folders: z.lazy(() => z.array(ComponentFolderSchema)).optional(),
  });

export const ComponentLibrarySchema = z.object({
  annotations: z.record(z.string(), z.unknown()).optional(),
  folders: z.array(ComponentFolderSchema),
});
