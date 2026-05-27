import { describe, expect, it, vi } from "vitest";

import { createLibraryObject } from "./factory";
import { ensureLibraryFactoriesRegistered } from "./setup";
import type { StoredLibrary } from "./storage";

const { mockGitHubFlatComponentLibrary } = vi.hoisted(() => ({
  mockGitHubFlatComponentLibrary: vi.fn(),
}));

vi.mock("@/components/shared/GitHubLibrary/githubFlatComponentLibrary", () => ({
  GitHubFlatComponentLibrary: mockGitHubFlatComponentLibrary,
}));

describe("ensureLibraryFactoriesRegistered", () => {
  it("registers the GitHub component library factory", () => {
    ensureLibraryFactoriesRegistered();

    const library = createLibraryObject({
      id: "github-lib",
      name: "GitHub library",
      type: "github",
      knownDigests: [],
      configuration: {
        created_at: "2026-01-01T00:00:00Z",
        last_updated_at: "2026-01-01T00:00:00Z",
        repo_name: "owner/repo",
        access_token: "",
        auto_update: false,
      },
    } satisfies StoredLibrary);

    expect(library).toBeInstanceOf(mockGitHubFlatComponentLibrary);
    expect(mockGitHubFlatComponentLibrary).toHaveBeenCalledWith("owner/repo");
  });
});
