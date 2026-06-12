import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Flag } from "@/types/configuration";

const mocks = vi.hoisted(() => {
  const betaFlags: Flag[] = [];
  return {
    betaFlags,
    handleSetFlag: vi.fn(),
    track: vi.fn(),
  };
});

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: mocks.track }),
}));

vi.mock("../SettingsFlagsContext", () => ({
  useSettingsFlags: () => ({
    betaFlags: mocks.betaFlags,
    handleSetFlag: mocks.handleSetFlag,
  }),
}));

import { BetaFeaturesSettings } from "./BetaFeaturesSettings";

const componentSearchFlag: Flag = {
  key: "component-search-v2",
  name: "Component Search",
  description: "Show component search.",
  default: false,
  enabled: false,
  category: "beta",
};

const aiDescriptionFlag: Flag = {
  key: "component-search-v2-ai-descriptions",
  name: "Auto-generate component search AI descriptions",
  description: "Automatically generate AI descriptions.",
  default: false,
  enabled: false,
  category: "beta",
};

describe("BetaFeaturesSettings", () => {
  beforeEach(() => {
    mocks.betaFlags = [];
    mocks.handleSetFlag.mockClear();
    mocks.track.mockClear();
  });

  it("hides the AI descriptions flag when component search is disabled", () => {
    mocks.betaFlags = [componentSearchFlag, aiDescriptionFlag];

    render(<BetaFeaturesSettings />);

    expect(screen.getByText("Component Search")).toBeInTheDocument();
    expect(
      screen.queryByText("Auto-generate component search AI descriptions"),
    ).not.toBeInTheDocument();
  });

  it("shows the AI descriptions flag when component search is enabled", () => {
    mocks.betaFlags = [
      { ...componentSearchFlag, enabled: true },
      aiDescriptionFlag,
    ];

    render(<BetaFeaturesSettings />);

    expect(screen.getByText("Component Search")).toBeInTheDocument();
    expect(
      screen.getByText("Auto-generate component search AI descriptions"),
    ).toBeInTheDocument();
  });
});
