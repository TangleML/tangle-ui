import { addMediaTypePlugin } from "@hyperjump/browser";
import { type OutputUnit, validate } from "@hyperjump/json-schema/draft-06";
import { buildSchemaDocument } from "@hyperjump/json-schema/experimental";

const COMPONENT_SPEC_SCHEMA_URL =
  "https://raw.githubusercontent.com/Cloud-Pipelines/component_spec_schema/refs/heads/master/component_spec.json_schema.json";

// Register media type plugin for the schema file
addMediaTypePlugin("text/plain", {
  parse: async (response) =>
    buildSchemaDocument(JSON.parse(await response.text())),
  fileMatcher: async (path) => path.endsWith(".json_schema.json"),
});

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

 
type JsonCompatible =
  | Record<string, any>
  | any[]
  | string
  | number
  | boolean
  | null;

let cachedValidator: ((value: JsonCompatible) => ValidationResult) | null =
  null;

/**
 * Validates a ComponentSpec JSON object against the official schema.
 * Uses cached validator for performance.
 */
export async function validateComponentSpec(
  json: JsonCompatible,
): Promise<ValidationResult> {
  if (!cachedValidator) {
    const validator = await validate(COMPONENT_SPEC_SCHEMA_URL);

    cachedValidator = (value: JsonCompatible): ValidationResult => {
      const result = validator(value, { outputFormat: "BASIC" });

      if (!result.valid && result.errors) {
        return {
          valid: false,
          errors: formatValidationErrors(result.errors),
        };
      }

      return { valid: result.valid };
    };
  }

  return cachedValidator(json);
}

function formatValidationErrors(errors: OutputUnit[]): string[] {
  const formattedErrors: string[] = [];

  for (const error of errors) {
    const location = error.instanceLocation || "#";
    const keyword = extractKeyword(error.keyword);

    // Extract the field path from the instance location
    const fieldPath = location.replace("#/", "").replace(/\//g, ".");

    let message: string;

    if (keyword === "required") {
      const parentPath = fieldPath || "root";
      message = `Missing required field in ${parentPath}`;
    } else if (keyword === "additionalProperties") {
      const parts = fieldPath.split(".");
      const invalidField = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join(".") || "root";
      message = `Unknown property "${invalidField}" in ${parentPath}`;
    } else if (keyword === "type") {
      message = `Invalid type at ${fieldPath || "root"}`;
    } else if (keyword === "enum") {
      message = `Invalid value at ${fieldPath || "root"} - must be one of the allowed values`;
    } else if (keyword === "oneOf" || keyword === "anyOf") {
      message = `Value at ${fieldPath || "root"} doesn't match any of the expected formats`;
    } else if (keyword === "validate") {
      if (error.absoluteKeywordLocation?.includes("additionalProperties")) {
        const parts = fieldPath.split(".");
        const invalidField = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join(".") || "root";
        message = `Unknown property "${invalidField}" in ${parentPath}`;
      } else {
        message = `Validation failed at ${fieldPath || "root"}`;
      }
    } else {
      message = `${keyword} validation failed at ${fieldPath || "root"}`;
    }

    if (!formattedErrors.includes(message)) {
      formattedErrors.push(message);
    }
  }

  return formattedErrors;
}

function extractKeyword(keywordUrl: string): string {
  const parts = keywordUrl.split("/");
  return parts[parts.length - 1] || "unknown";
}
