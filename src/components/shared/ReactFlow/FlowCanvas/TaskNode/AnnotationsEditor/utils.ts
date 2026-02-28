import schema from "@/config/launcherTaskAnnotationSchema.json";
import type { AnnotationConfig, AnnotationOption } from "@/types/annotations";

interface JSONSchemaProperty {
  type: string;
  title?: string;
  description?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  pattern?: string;
  enum?: string[];
  "x-unit"?: string;
  "x-append"?: string;
  "x-enable-quantity"?: boolean;
  "x-enum-labels"?: Record<string, string>;
  "x-hidden"?: boolean;
  "x-type"?: string;
}

interface JSONSchemaObject {
  type: string;
  title?: string;
  properties: Record<string, JSONSchemaProperty>;
  "x-label"?: string;
}

interface CloudProviderSchema extends JSONSchemaProperty {
  annotation: string;
}

interface LauncherAnnotationSchema {
  $schema?: string;
  type?: string;
  title?: string;
  cloud_provider?: CloudProviderSchema;
  launcher_annotation_schemas?: Record<string, JSONSchemaObject>;
  common_annotations?: JSONSchemaObject;
}

export const launcherTaskAnnotationSchema =
  schema satisfies LauncherAnnotationSchema;

export function parseSchemaToAnnotationConfig(
  schema: JSONSchemaObject,
): AnnotationConfig[] {
  const configs: AnnotationConfig[] = [];

  for (const [annotation, property] of Object.entries(schema.properties)) {
    const config: AnnotationConfig = {
      annotation,
      label: property.title || annotation,
    };

    // Handle unit
    if (property["x-unit"]) {
      config.unit = property["x-unit"];
    }

    // Handle append suffix
    if (property["x-append"]) {
      config.append = property["x-append"];
    }

    // Handle min/max for numbers
    if (property.exclusiveMinimum !== undefined) {
      config.min = property.exclusiveMinimum;
    }
    if (property.exclusiveMaximum !== undefined) {
      config.max = property.exclusiveMaximum;
    }
    if (property.minimum !== undefined) {
      config.min = property.minimum;
    }
    if (property.maximum !== undefined) {
      config.max = property.maximum;
    }

    // Handle type
    // Check for custom x-type first
    const customType = property["x-type"];
    if (customType === "json") {
      config.type = "json";
    } else if (property.type === "number") {
      config.type = "number";
    } else if (property.type === "integer") {
      config.type = "integer";
    } else if (property.type === "boolean") {
      config.type = "boolean";
    } else if (property.type === "string") {
      config.type = "string";
    }

    // Handle enum as options
    if (property.enum) {
      const options: AnnotationOption[] = property.enum.map((value) => ({
        value,
        name: property["x-enum-labels"]?.[value] || value,
      }));
      config.options = options;
    }

    // Handle quantity enablement
    if (property["x-enable-quantity"]) {
      config.enableQuantity = true;
    }

    if (property["x-hidden"]) {
      config.hidden = true;
    }

    configs.push(config);
  }

  return configs;
}

function parseCloudProviderConfig(
  providerSchema: CloudProviderSchema,
): AnnotationConfig {
  const config: AnnotationConfig = {
    annotation: providerSchema.annotation,
    label: providerSchema.title || "Cloud Provider",
    type: "string",
  };

  if (providerSchema.enum) {
    const options: AnnotationOption[] = providerSchema.enum.map((value) => ({
      value,
      name: providerSchema["x-enum-labels"]?.[value] || value,
    }));
    config.options = options;
  }

  return config;
}

export function getCloudProviderConfig(
  schema: LauncherAnnotationSchema,
): AnnotationConfig | null {
  if (!schema.cloud_provider || !schema.launcher_annotation_schemas) {
    return null;
  }

  const config = parseCloudProviderConfig(schema.cloud_provider);

  // If no manual enum is specified, generate from launcher schemas
  if (!config.options) {
    const options: AnnotationOption[] = Object.entries(
      schema.launcher_annotation_schemas,
    ).map(([key, launcherSchema]) => ({
      value: key,
      name:
        launcherSchema["x-label"] ||
        launcherSchema.title ||
        key.charAt(0).toUpperCase() + key.slice(1),
    }));
    config.options = options;
  }

  return config;
}

export function getProviderSchema(
  schema: LauncherAnnotationSchema,
  provider: string | undefined,
): JSONSchemaObject | null {
  if (!provider || !schema.launcher_annotation_schemas) {
    return null;
  }

  return schema.launcher_annotation_schemas[provider] || null;
}

export function getCommonAnnotations(
  schema: LauncherAnnotationSchema,
): AnnotationConfig[] {
  if (!schema.common_annotations) {
    return [];
  }

  return parseSchemaToAnnotationConfig(schema.common_annotations);
}
