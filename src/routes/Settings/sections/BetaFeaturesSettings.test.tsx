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

const componentSearchFlag: Flag = {
  key: "component-search-v2",
  name: "Component Search",
  description: "Show component search.",
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
    mocks.betaFlags = [componentSearchFlag];

    render(<BetaFeaturesSettings />);

    expect(screen.getByText("Component Search")).toBeInTheDocument();
  });

  it("tracks and forwards a toggle change", () => {
    mocks.betaFlags = [componentSearchFlag];

    render(<BetaFeaturesSettings />);
    fireEvent.click(screen.getByTestId("component-search-v2-switch"));

    expect(mocks.track).toHaveBeenCalledWith("settings.toggle_changed", {
      section: "beta_features",
      flag_name: "component-search-v2",
      new_value: true,
    });
    expect(mocks.handleSetFlag).toHaveBeenCalledWith(
      "component-search-v2",
      true,
    );
  });

  it("locks a flag this build cannot enable", () => {
    mocks.betaFlags = [{ ...componentSearchFlag, canEnable: false }];

    render(<BetaFeaturesSettings />);
    const toggle = screen.getByTestId("component-search-v2-switch");

    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(mocks.handleSetFlag).not.toHaveBeenCalled();
  });

  it("still lets an already-enabled flag be turned off", () => {
    mocks.betaFlags = [
      { ...componentSearchFlag, canEnable: false, enabled: true },
    ];

    render(<BetaFeaturesSettings />);
    const toggle = screen.getByTestId("component-search-v2-switch");

    expect(toggle).toBeEnabled();
    fireEvent.click(toggle);

    expect(mocks.handleSetFlag).toHaveBeenCalledWith(
      "component-search-v2",
      false,
    );
  });
});
