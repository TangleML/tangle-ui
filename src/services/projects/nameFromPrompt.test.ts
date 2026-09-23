import { describe, expect, it } from "vitest";

import { nameFromPrompt } from "./nameFromPrompt";

describe("nameFromPrompt", () => {
  it("names a project after what was asked for", () => {
    expect(nameFromPrompt("Build a churn model for Q3")).toBe(
      "Build a churn model for Q3",
    );
  });

  it("drops the address to the agent in front of the ask", () => {
    expect(nameFromPrompt("Can you build a churn model")).toBe(
      "Build a churn model",
    );
    expect(nameFromPrompt("hey, please fix the failing run")).toBe(
      "Fix the failing run",
    );
  });

  /** A brief is a paragraph; only the opening clause is a title. */
  it("takes the first sentence of a longer brief", () => {
    expect(
      nameFromPrompt(
        "Fix the failing churn run. The preprocessing step times out and I think the batch size is wrong.",
      ),
    ).toBe("Fix the failing churn run");
  });

  it("takes the first line of a pasted brief", () => {
    expect(
      nameFromPrompt("Train a ranking model\n\n- use the new features"),
    ).toBe("Train a ranking model");
  });

  it("cuts a long opening at a word boundary", () => {
    const name = nameFromPrompt(
      "Build an end to end training pipeline that also evaluates the model",
    );

    expect(name).toBe("Build an end to end training pipeline");
    expect(name!.length).toBeLessThanOrEqual(40);
  });

  /** Cutting on the word boundary alone left "…for Q3 using the new". */
  it("cuts a long ask at the phrase, not mid-thought", () => {
    expect(
      nameFromPrompt("Build a churn model for Q3 using the new features"),
    ).toBe("Build a churn model for Q3");
  });

  it("keeps the fragment when dropping the phrase would say nothing", () => {
    expect(
      nameFromPrompt("Retrain with the enormous new feature set we discussed"),
    ).toBe("Retrain with the enormous new feature");
  });

  it("keeps a single long word rather than returning nothing", () => {
    expect(
      nameFromPrompt("Supercalifragilisticexpialidociousrepipelining today"),
    ).toBe("Supercalifragilisticexpialidociousrepipe");
  });

  it("collapses the whitespace of a wrapped prompt", () => {
    expect(nameFromPrompt("  Build   a  churn    model  ")).toBe(
      "Build a churn model",
    );
  });

  it("leaves the caller to fall back when there is nothing to name", () => {
    expect(nameFromPrompt("")).toBeUndefined();
    expect(nameFromPrompt("   ")).toBeUndefined();
    expect(nameFromPrompt("hi")).toBeUndefined();
    expect(nameFromPrompt("???")).toBeUndefined();
  });

  /** "Can you" on its own is an address with nothing behind it. */
  it("does not name a project after a bare pleasantry", () => {
    expect(nameFromPrompt("can you?")).toBeUndefined();
  });
});
