import { fireEvent, render, screen } from "@testing-library/react";
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

const compareRunsFlag: Flag = {
  key: "compare-runs",
  name: "Compare Runs",
  description: "Compare pipeline runs.",
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

  it("renders the beta flags it is given", () => {
    mocks.betaFlags = [compareRunsFlag];

    render(<BetaFeaturesSettings />);

    expect(screen.getByText("Compare Runs")).toBeInTheDocument();
  });

  it("tracks and forwards a toggle change", () => {
    mocks.betaFlags = [compareRunsFlag];

    render(<BetaFeaturesSettings />);
    fireEvent.click(screen.getByTestId("compare-runs-switch"));

    expect(mocks.track).toHaveBeenCalledWith("settings.toggle_changed", {
      section: "beta_features",
      flag_name: "compare-runs",
      new_value: true,
    });
    expect(mocks.handleSetFlag).toHaveBeenCalledWith("compare-runs", true);
  });

  it("locks a flag this build cannot enable", () => {
    mocks.betaFlags = [{ ...compareRunsFlag, canEnable: false }];

    render(<BetaFeaturesSettings />);
    const toggle = screen.getByTestId("compare-runs-switch");

    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(mocks.handleSetFlag).not.toHaveBeenCalled();
  });

  it("still lets an already-enabled flag be turned off", () => {
    mocks.betaFlags = [{ ...compareRunsFlag, canEnable: false, enabled: true }];

    render(<BetaFeaturesSettings />);
    const toggle = screen.getByTestId("compare-runs-switch");

    expect(toggle).toBeEnabled();
    fireEvent.click(toggle);

    expect(mocks.handleSetFlag).toHaveBeenCalledWith("compare-runs", false);
  });
});
