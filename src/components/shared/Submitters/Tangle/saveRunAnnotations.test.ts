import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/pipelineRunService", () => ({
  updateRunAnnotation: vi.fn(),
}));

import { updateRunAnnotation } from "@/services/pipelineRunService";
import type { ComponentSpec } from "@/utils/componentSpec";

import { saveRunAnnotations } from "./saveRunAnnotations";

const BACKEND_URL = "https://api.example.com";
const TEAM_ID = "ml-team@project.iam.gserviceaccount.com";

const taggedSpec: ComponentSpec = {
  name: "tagged",
  metadata: { annotations: { tags: "nightly,training" } },
  implementation: { container: { image: "test:latest" } },
};

describe("saveRunAnnotations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateRunAnnotation).mockResolvedValue(undefined);
  });

  it("writes the notes and tags as the team that started the run", async () => {
    await saveRunAnnotations(
      "42",
      BACKEND_URL,
      { notes: "Baseline", componentSpec: taggedSpec },
      TEAM_ID,
    );

    expect(updateRunAnnotation).toHaveBeenCalledWith(
      "42",
      BACKEND_URL,
      { key: "notes", value: "Baseline" },
      TEAM_ID,
    );
    expect(updateRunAnnotation).toHaveBeenCalledWith(
      "42",
      BACKEND_URL,
      { key: "tags", value: "nightly,training" },
      TEAM_ID,
    );
  });

  it("writes them as the user without a team", async () => {
    await saveRunAnnotations("42", BACKEND_URL, { notes: "Baseline" });

    expect(updateRunAnnotation).toHaveBeenCalledWith(
      "42",
      BACKEND_URL,
      { key: "notes", value: "Baseline" },
      undefined,
    );
  });
});
