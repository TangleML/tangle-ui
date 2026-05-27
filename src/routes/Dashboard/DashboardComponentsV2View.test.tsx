import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";

import {
  createRegisteredLibrariesFingerprint,
  SourceFilterBar,
  type SourceFilterOption,
} from "./DashboardComponentsV2View";

const options: SourceFilterOption[] = [
  {
    source: { kind: "standard", label: "Standard", id: "standard" },
    count: 2,
  },
  {
    source: { kind: "registered", label: "GitHub", id: "github-lib" },
    count: 3,
  },
  {
    source: { kind: "user", label: "User", id: "user" },
    count: 1,
  },
];

describe("createRegisteredLibrariesFingerprint", () => {
  it("excludes secret-bearing library configuration", () => {
    const libraries: StoredLibrary[] = [
      {
        id: "github-lib",
        name: "GitHub",
        type: "github",
        knownDigests: ["digest-1"],
        configuration: {
          repo_name: "owner/repo",
          last_updated_at: "2026-01-01T00:00:00Z",
          access_token: "ghp_secret-token",
          auto_update: true,
        },
      },
    ];

    const fingerprint = createRegisteredLibrariesFingerprint(libraries);

    expect(fingerprint).toContain("owner/repo");
    expect(fingerprint).not.toContain("ghp_secret-token");
    expect(fingerprint).not.toContain("access_token");
  });
});

describe("SourceFilterBar", () => {
  it("toggles source buttons and exposes active state", () => {
    const onToggle = vi.fn();
    const onEnableAll = vi.fn();

    render(
      <SourceFilterBar
        options={options}
        disabledSourceKeys={["registered:github-lib"]}
        onToggle={onToggle}
        onEnableAll={onEnableAll}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Hide Standard source (2 components)",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Show GitHub source (3 components)" }),
    ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(
      screen.getByRole("button", { name: "Show GitHub source (3 components)" }),
    );
    expect(onToggle).toHaveBeenCalledWith("registered:github-lib");

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(onEnableAll).toHaveBeenCalledTimes(1);
  });
});
