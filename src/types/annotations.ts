export type Annotations = Record<string, unknown>;

export type AnnotationOption = {
  value: string;
  name: string;
  provider?: string;
  project?: string;
  cluster?: string;
  deprecated?: boolean;
  deprecationMessage?: string;
};

export type AnnotationConfig = {
  annotation: string;
  label: string;
  unit?: string;
  append?: string;
  options?: AnnotationOption[];
  allowCustomValue?: boolean;
  enableQuantity?: boolean;
  type?: "string" | "number" | "integer" | "boolean" | "json";
  min?: number;
  max?: number;
  hidden?: boolean;
  required?: boolean;
  description?: string;
};
