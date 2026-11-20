export function yamlErrorOutcome(
  err: unknown,
  fallback = "Could not read this YAML file.",
): { status: "error"; message: string; detail?: string } {
  const errorMessage =
    err instanceof Error && err.message ? err.message : fallback;
  // js-yaml appends the excerpt to its message after a blank line.
  const [message, ...excerpt] = errorMessage.split("\n\n");
  return excerpt.length > 0
    ? { status: "error", message, detail: excerpt.join("\n\n") }
    : { status: "error", message };
}
