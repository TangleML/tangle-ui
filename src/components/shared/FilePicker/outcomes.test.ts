import * as yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import { yamlErrorOutcome } from "./outcomes";

function yamlExceptionFor(text: string): Error {
  try {
    yaml.load(text);
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the YAML to fail to parse");
}

describe("yamlErrorOutcome", () => {
  it("splits an error message with an excerpt into message and detail", () => {
    expect(
      yamlErrorOutcome(new Error("bad indentation (2:1)\n\n 1 | a:\n 2 | b")),
    ).toEqual({
      status: "error",
      message: "bad indentation (2:1)",
      detail: " 1 | a:\n 2 | b",
    });
  });

  it("returns only the message when there is no excerpt", () => {
    expect(yamlErrorOutcome(new Error("Invalid component spec"))).toEqual({
      status: "error",
      message: "Invalid component spec",
    });
  });

  it("uses the fallback for a non-Error value", () => {
    expect(yamlErrorOutcome("oops", "Could not import")).toEqual({
      status: "error",
      message: "Could not import",
    });
  });

  it("uses the fallback for an Error with an empty message", () => {
    expect(yamlErrorOutcome(new Error(""), "Could not import")).toEqual({
      status: "error",
      message: "Could not import",
    });
  });

  it("prefixes a YAMLException message with the syntax error label", () => {
    const error = yamlExceptionFor("{{{");
    const [reason, excerpt] = error.message.split("\n\n");

    expect(yamlErrorOutcome(error)).toEqual({
      status: "error",
      message: `YAML syntax error: ${reason}`,
      detail: excerpt,
    });
  });

  it("does not prefix a YAMLException message that already has the label", () => {
    const error = yamlExceptionFor("{{{");
    error.message = `YAML syntax error: ${error.message}`;

    const { message } = yamlErrorOutcome(error);

    expect(message).toMatch(/^YAML syntax error: (?!YAML syntax error: )/);
  });
});
