import { z } from "zod";

export const AnnotationsSchema = z.record(z.string(), z.string());

export const AnnotationOptionSchema = z.object({
  value: z.string(),
  name: z.string(),
});

export const AnnotationConfigSchema = z.object({
  annotation: z.string(),
  label: z.string(),
  unit: z.string().optional(),
  append: z.string().optional(),
  options: z.array(AnnotationOptionSchema).optional(),
  enableQuantity: z.boolean().optional(),
  type: z.enum(["string", "number", "boolean", "json"]).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  hidden: z.boolean().optional(),
});

export type Annotations = z.infer<typeof AnnotationsSchema>;
export type AnnotationOption = z.infer<typeof AnnotationOptionSchema>;
export type AnnotationConfig = z.infer<typeof AnnotationConfigSchema>;
