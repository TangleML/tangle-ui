import { describe, expect, it, vi } from "vitest";

import type { ComponentReference } from "@/utils/componentSpec";

import { writeToSystemClipboard } from "./clipboardEnvelope";
import { copyComponentReferenceToClipboard } from "./copyComponentReferenceToClipboard";

vi.mock("./clipboardEnvelope", () => ({
  writeToSystemClipboard: vi.fn(),
}));

describe("copyComponentReferenceToClipboard", () => {
  it("writes a single task snapshot for the component reference", async () => {
    const reference: ComponentReference = {
      digest: "abc",
      spec: {
        name: "train_model",
        inputs: [],
        outputs: [],
        implementation: { container: { image: "python:3.11" } },
      },
    };

    await copyComponentReferenceToClipboard(reference);

    expect(writeToSystemClipboard).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          $type: "task",
          name: "train_model",
          data: expect.objectContaining({ componentRef: reference }),
        }),
      ],
      [],
    );
  });
});
