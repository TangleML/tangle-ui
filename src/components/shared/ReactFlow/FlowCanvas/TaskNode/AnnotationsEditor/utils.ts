import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
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
  inclusiveMinimum?: number;
  inclusiveMaximum?: number;
  pattern?: string;
  enum?: string[];
  required?: boolean;
  "x-unit"?: string;
  "x-append"?: string;
  "x-enable-quantity"?: boolean;
  "x-enum-labels"?: Record<string, string>;
  "x-enum-deprecated"?: Record<string, boolean>;
  "x-enum-deprecated-messages"?: Record<string, string>;
  "x-allow-custom-value"?: boolean;
  "x-hidden"?: boolean;
  "x-type"?: string;
}

interface JSONSchemaObject {
  type: string;
  title?: string;
  properties: Record<string, JSONSchemaProperty>;
  "feature-flag-key"?: string;
  "x-active"?: boolean;
  "x-deprecated"?: boolean;
  "x-deprecated-message"?: string;
  "x-provider"?: string;
  "x-project"?: string;
  "x-cluster"?: string;
  "x-legacy-keys"?: string[];
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

    if (property.required) {
      config.required = true;
    }

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
      config.min = property.exclusiveMinimum + 1;
    }
    if (property.exclusiveMaximum !== undefined) {
      config.max = property.exclusiveMaximum - 1;
    }
    if (property.inclusiveMinimum !== undefined) {
      config.min = property.inclusiveMinimum;
    }
    if (property.inclusiveMaximum !== undefined) {
      config.max = property.inclusiveMaximum;
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
      config.options = enumToOptions(property);
    }

    // Handle custom value allowance
    if (property["x-allow-custom-value"]) {
      config.allowCustomValue = true;
    }

    if (property.description) {
      config.description = property.description;
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
    config.options = enumToOptions(providerSchema);
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
    )
      .filter(([, launcherSchema]) => {
        if (launcherSchema["x-active"] === false) {
          return false;
        }
        const flagKey = launcherSchema["feature-flag-key"];
        return !flagKey || isFlagEnabled(flagKey);
      })
      .map(([key, launcherSchema]) => {
        const option: AnnotationOption = {
          value: key,
          name: launcherSchema.title || key,
        };
        if (launcherSchema["x-provider"]) {
          option.provider = launcherSchema["x-provider"];
        }
        if (launcherSchema["x-project"]) {
          option.project = launcherSchema["x-project"];
        }
        if (launcherSchema["x-cluster"]) {
          option.cluster = launcherSchema["x-cluster"];
        }
        if (launcherSchema["x-deprecated"]) {
          option.deprecated = true;
          const message = launcherSchema["x-deprecated-message"];
          if (message) {
            option.deprecationMessage = message;
          }
        }
        return option;
      });
    config.options = options;
  }

  return config;
}

export function resolveLauncherKey(
  schema: LauncherAnnotationSchema,
  value: string | undefined,
): string | undefined {
  if (!value || !schema.launcher_annotation_schemas) {
    return value;
  }

  if (schema.launcher_annotation_schemas[value]) {
    return value;
  }

  for (const [key, launcherSchema] of Object.entries(
    schema.launcher_annotation_schemas,
  )) {
    if (launcherSchema["x-legacy-keys"]?.includes(value)) {
      return key;
    }
  }

  return value;
}

export function getProviderSchema(
  schema: LauncherAnnotationSchema,
  provider: string | undefined,
): JSONSchemaObject | null {
  if (!provider || !schema.launcher_annotation_schemas) {
    return null;
  }

  const resolvedKey = resolveLauncherKey(schema, provider);
  return schema.launcher_annotation_schemas[resolvedKey ?? provider] || null;
}

export function getCommonAnnotations(
  schema: LauncherAnnotationSchema,
): AnnotationConfig[] {
  if (!schema.common_annotations) {
    return [];
  }

  return parseSchemaToAnnotationConfig(schema.common_annotations);
}

function enumToOptions(property: JSONSchemaProperty): AnnotationOption[] {
  const labels = property["x-enum-labels"];
  const deprecated = property["x-enum-deprecated"];
  const messages = property["x-enum-deprecated-messages"];

  return (property.enum ?? []).map((value) => {
    const option: AnnotationOption = {
      value,
      name: labels?.[value] || value,
    };
    if (deprecated?.[value]) {
      option.deprecated = true;
      const message = messages?.[value];
      if (message) {
        option.deprecationMessage = message;
      }
    }
    return option;
  });
}
