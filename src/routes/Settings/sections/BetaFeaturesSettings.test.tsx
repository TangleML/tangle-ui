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
  name: "Component Search V2",
  description: "Show Components V2.",
  default: false,
  enabled: false,
  category: "beta",
};

const aiDescriptionFlag: Flag = {
  key: "component-search-v2-ai-descriptions",
  name: "Auto-generate Components V2 AI descriptions",
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

  it("hides the AI descriptions flag when Components V2 is disabled", () => {
    mocks.betaFlags = [componentSearchFlag, aiDescriptionFlag];

    render(<BetaFeaturesSettings />);

    expect(screen.getByText("Component Search V2")).toBeInTheDocument();
    expect(
      screen.queryByText("Auto-generate Components V2 AI descriptions"),
    ).not.toBeInTheDocument();
  });

  it("shows the AI descriptions flag when Components V2 is enabled", () => {
    mocks.betaFlags = [
      { ...componentSearchFlag, enabled: true },
      aiDescriptionFlag,
    ];

    render(<BetaFeaturesSettings />);

    expect(screen.getByText("Component Search V2")).toBeInTheDocument();
    expect(
      screen.getByText("Auto-generate Components V2 AI descriptions"),
    ).toBeInTheDocument();
  });
});
