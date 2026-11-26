const YAML_SYNTAX_ERROR_PREFIX = "YAML syntax error: ";

function isYamlException(err: unknown): err is Error {
  return err instanceof Error && err.name === "YAMLException";
}

export function yamlErrorOutcome(
  err: unknown,
  fallback = "Could not read this YAML file.",
): { status: "error"; message: string; detail?: string } {
  const errorMessage =
    err instanceof Error && err.message ? err.message : fallback;
  // js-yaml appends the excerpt to its message after a blank line.
  const [reason, ...excerpt] = errorMessage.split("\n\n");
  const message =
    isYamlException(err) && !reason.startsWith(YAML_SYNTAX_ERROR_PREFIX)
      ? `${YAML_SYNTAX_ERROR_PREFIX}${reason}`
      : reason;
  return excerpt.length > 0
    ? { status: "error", message, detail: excerpt.join("\n\n") }
    : { status: "error", message };
}
