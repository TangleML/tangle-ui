import { z } from "zod";

const ConfigFlagSchema = z.object({
  name: z.string(),
  description: z.string(),
  default: z.boolean(),
  category: z.enum(["beta", "setting"]),
});

export const ConfigFlagsSchema = z.record(z.string(), ConfigFlagSchema);

export const FlagSchema = ConfigFlagSchema.extend({
  key: z.string(),
  enabled: z.boolean(),
});

export type ConfigFlags = z.infer<typeof ConfigFlagsSchema>;
export type Flag = z.infer<typeof FlagSchema>;
