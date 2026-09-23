import { describe, expect, it } from "vitest";

import { requestFailureMessage } from "./requestFailureMessage";

function refusal(body: unknown, status = 422, statusText = "Unprocessable") {
  return new Response(
    typeof body === "string" ? body : JSON.stringify(body),
    typeof body === "string"
      ? { status, statusText }
      : { status, statusText, headers: { "Content-Type": "application/json" } },
  );
}

const describeIt = (body: unknown, status?: number) =>
  requestFailureMessage(refusal(body, status), "Failed to create pipeline run");

describe("requestFailureMessage", () => {
  /** The case that sent an agent looking for a serialization bug for 4 minutes. */
  it("names the field the server would not accept, and the value it got", async () => {
    const message = await describeIt({
      detail: [
        {
          type: "string_type",
          loc: [
            "body",
            "root_task",
            "componentRef",
            "spec",
            "inputs",
            0,
            "default",
          ],
          msg: "Input should be a valid string",
          input: true,
        },
      ],
    });

    expect(message).toBe(
      "Failed to create pipeline run (422 Unprocessable): " +
        "root_task.componentRef.spec.inputs.0.default: " +
        "Input should be a valid string (got true)",
    );
  });

  it("reports several rejected fields, capped", async () => {
    const message = await describeIt({
      detail: Array.from({ length: 5 }, (_, index) => ({
        loc: ["body", `field_${index}`],
        msg: "Input should be a valid string",
      })),
    });

    expect(message).toContain("field_0: Input should be a valid string");
    expect(message).toContain("field_2: Input should be a valid string");
    expect(message).not.toContain("field_3");
    expect(message).toContain("(and 2 more)");
  });

  it("passes on a plain-string detail", async () => {
    expect(await describeIt({ detail: "Pipeline is too large" })).toBe(
      "Failed to create pipeline run (422 Unprocessable): Pipeline is too large",
    );
  });

  it("falls back to a message field", async () => {
    expect(await describeIt({ message: "Quota exhausted" })).toContain(
      "Quota exhausted",
    );
  });

  it("keeps a body that is not JSON", async () => {
    expect(await describeIt("upstream connect error")).toContain(
      "upstream connect error",
    );
  });

  /** A 500 with an empty body still has to say something. */
  it("says the status when the server explains nothing", async () => {
    const message = await requestFailureMessage(
      new Response("", { status: 500, statusText: "Internal Server Error" }),
      "Failed to create pipeline run",
    );

    expect(message).toBe(
      "Failed to create pipeline run (500 Internal Server Error)",
    );
  });

  it("does not let a huge rejected value run away with the message", async () => {
    const message = await describeIt({
      detail: [
        {
          loc: ["body", "spec"],
          msg: "Input should be a valid string",
          input: "x".repeat(500),
        },
      ],
    });

    expect(message.length).toBeLessThan(200);
    expect(message).toContain("…");
  });

  it("still reads an issue with no location", async () => {
    expect(
      await describeIt({ detail: [{ msg: "Something was wrong" }] }),
    ).toContain("Something was wrong");
  });
});
