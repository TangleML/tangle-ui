import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StoredLibrary } from "./libraries/storage";

const { mockGitHubFlatComponentLibrary, storedLibraries } = vi.hoisted(() => ({
  mockGitHubFlatComponentLibrary: vi.fn(),
  storedLibraries: [] as StoredLibrary[],
}));

vi.mock("@/components/shared/GitHubLibrary/githubFlatComponentLibrary", () => ({
  GitHubFlatComponentLibrary: mockGitHubFlatComponentLibrary,
}));

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: () => storedLibraries,
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "" }),
}));

import { useComponentLibraryRegistry } from "./ComponentLibraryProvider";

const validGitHubConfiguration = {
  created_at: "2026-01-01T00:00:00Z",
  last_updated_at: "2026-01-01T00:00:00Z",
  repo_name: "owner/repo",
  access_token: "",
  auto_update: false,
};

const githubLibrary = (
  id: string,
  configuration: Record<string, unknown>,
): StoredLibrary => ({
  id,
  name: id,
  type: "github",
  knownDigests: [],
  configuration,
});

const unknownTypeLibrary = {
  id: "bogus-library",
  name: "bogus-library",
  type: "bogus",
  knownDigests: [],
} as unknown as StoredLibrary;

const configurationWithoutCreatedAt = {
  last_updated_at: validGitHubConfiguration.last_updated_at,
  repo_name: validGitHubConfiguration.repo_name,
  access_token: validGitHubConfiguration.access_token,
  auto_update: validGitHubConfiguration.auto_update,
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe("useComponentLibraryRegistry", () => {
  afterEach(() => {
    storedLibraries.length = 0;
    vi.restoreAllMocks();
    mockGitHubFlatComponentLibrary.mockClear();
  });

  it("skips stored libraries that cannot be loaded and registers the rest", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    storedLibraries.push(
      unknownTypeLibrary,
      githubLibrary("first-valid-library", validGitHubConfiguration),
      githubLibrary("invalid-github-library", configurationWithoutCreatedAt),
      githubLibrary("second-valid-library", validGitHubConfiguration),
    );

    const { result } = renderHook(() => useComponentLibraryRegistry(), {
      wrapper,
    });

    expect(
      result.current.getComponentLibraryObject("first-valid-library"),
    ).toBeInstanceOf(mockGitHubFlatComponentLibrary);
    expect(
      result.current.getComponentLibraryObject("second-valid-library"),
    ).toBeInstanceOf(mockGitHubFlatComponentLibrary);
    expect(() =>
      result.current.getComponentLibraryObject("bogus-library"),
    ).toThrow('Component library "bogus-library" is not found.');
    expect(() =>
      result.current.getComponentLibraryObject("invalid-github-library"),
    ).toThrow('Component library "invalid-github-library" is not found.');

    expect(
      result.current.existingComponentLibraries.map((library) => library.id),
    ).toEqual(["first-valid-library", "second-valid-library"]);

    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('"bogus-library" of type "bogus"'),
      expect.objectContaining({ name: "UnsupportedLibraryTypeError" }),
    );
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('"invalid-github-library" of type "github"'),
      expect.objectContaining({
        message:
          'GitHub library configuration is not valid for "invalid-github-library"',
      }),
    );
  });
});
