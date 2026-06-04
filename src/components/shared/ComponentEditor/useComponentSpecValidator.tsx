import { addMediaTypePlugin } from "@hyperjump/browser";
import { type OutputUnit, validate } from "@hyperjump/json-schema/draft-06";
import { buildSchemaDocument } from "@hyperjump/json-schema/experimental";
import { useSuspenseQuery } from "@tanstack/react-query";
import yaml from "js-yaml";

import { PIPELINE_YAML_LOAD_OPTIONS } from "@/utils/yaml";

const COMPONENT_SPEC_SCHEMA_URL =
  "https://raw.githubusercontent.com/Cloud-Pipelines/component_spec_schema/refs/heads/master/component_spec.json_schema.json";

addMediaTypePlugin("text/plain", {
  parse: async (response) =>
    buildSchemaDocument(JSON.parse(await response.text())),
  fileMatcher: async (path) => path.endsWith(".json_schema.json"),
});

interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export const useComponentSpecValidator = () => {
  const { data: validator } = useSuspenseQuery({
    queryKey: ["componentSpecValidator"],
    queryFn: async () => {
      const validator = await validate(COMPONENT_SPEC_SCHEMA_URL);

      return (value: any): ValidationResult => {
        const normalizedValue = normalizeValue(value);

        if (!normalizedValue) {
          return {
            valid: false,
            errors: ["Failed to parse YAML: Invalid syntax"],
          };
        }

        const result = validator(normalizedValue, { outputFormat: "BASIC" });

        if (!result.valid && result.errors) {
          return {
            valid: false,
            errors: formatValidationErrors(result.errors),
          };
        }

        return { valid: result.valid };
      };
    },
    staleTime: Infinity,
  });
  return validator;
};

function formatValidationErrors(errors: OutputUnit[]): string[] {
  const formattedErrors: string[] = [];

  for (const error of errors) {
    const location = error.instanceLocation || "#";
    const keyword = extractKeyword(error.keyword);

    // Extract the field path from the instance location
    const fieldPath = location.replace("#/", "").replace(/\//g, ".");

    // Format error based on keyword type
    let message: string;

    if (keyword === "required") {
      // Extract which field is missing from the error location
      const parentPath = fieldPath || "root";
      message = `Missing required field in ${parentPath}`;
    } else if (keyword === "additionalProperties") {
      // For additional properties, the field path includes the invalid property
      const parts = fieldPath.split(".");
      const invalidField = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join(".") || "root";
      message = `Unknown property "${invalidField}" in ${parentPath}`;
    } else if (keyword === "type") {
      message = `Invalid type at ${fieldPath || "root"}`;
    } else if (keyword === "enum") {
      message = `Invalid value at ${fieldPath || "root"} - must be one of the allowed values`;
    } else if (keyword === "pattern") {
      message = `Invalid format at ${fieldPath || "root"}`;
    } else if (keyword === "minLength" || keyword === "maxLength") {
      message = `Invalid length at ${fieldPath || "root"}`;
    } else if (keyword === "minimum" || keyword === "maximum") {
      message = `Value out of range at ${fieldPath || "root"}`;
    } else if (keyword === "oneOf" || keyword === "anyOf") {
      message = `Value at ${fieldPath || "root"} doesn't match any of the expected formats`;
    } else if (keyword === "validate") {
      // This is typically a wrapper error, check if it's about additional properties
      if (error.absoluteKeywordLocation?.includes("additionalProperties")) {
        const parts = fieldPath.split(".");
        const invalidField = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join(".") || "root";
        message = `Unknown property "${invalidField}" in ${parentPath}`;
      } else {
        message = `Validation failed at ${fieldPath || "root"}`;
      }
    } else {
      // Generic message for other keywords
      message = `${keyword} validation failed at ${fieldPath || "root"}`;
    }

    // Avoid duplicate messages
    if (!formattedErrors.includes(message)) {
      formattedErrors.push(message);
    }
  }

  return formattedErrors;
}

function extractKeyword(keywordUrl: string): string {
  // Extract the keyword from the URL format
  // e.g., "https://json-schema.org/keyword/required" -> "required"
  // or "https://json-schema.org/evaluation/validate" -> "validate"
  const parts = keywordUrl.split("/");
  return parts[parts.length - 1] || "unknown";
}

function normalizeValue(value: any): any {
  if (typeof value === "string") {
    // assuming it is YAML
    // todo: worth revisiting
    try {
      return yaml.load(value, PIPELINE_YAML_LOAD_OPTIONS) as any;
    } catch {
      return undefined;
    }
  }

  return value;
}
