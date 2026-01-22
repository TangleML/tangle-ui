import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Flag } from "@/types/configuration";

import { PersonalPreferencesDialog } from "../PersonalPreferencesDialog";
import { useFlagsReducer } from "../useFlagsReducer";

// Mock the useFlagsReducer hook
vi.mock("../useFlagsReducer");

describe("PersonalPreferencesDialog", () => {
  const mockDispatch = vi.fn();
  const mockSetOpen = vi.fn();

  const mockBetaFlags: Flag[] = [
    {
      key: "codeViewer",
      name: "Code Viewer virtualization",
      description: "Enable the code viewer virtualization.",
      enabled: false,
      default: false,
      category: "beta",
    },
    {
      key: "testFeature",
      name: "Test Feature",
      description: "A test feature for testing purposes.",
      enabled: true,
      default: false,
      category: "setting",
    },
  ];

  const mockuseFlagsReducer = vi.mocked(useFlagsReducer);

  beforeEach(() => {
    vi.clearAllMocks();
    mockuseFlagsReducer.mockReturnValue([mockBetaFlags, mockDispatch]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should render dialog when open is true", () => {
    render(<PersonalPreferencesDialog open={true} setOpen={mockSetOpen} />);

    expect(
      screen.getByRole("dialog", { name: "Personal Preferences" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Personal Preferences")).toBeInTheDocument();
    expect(
      screen.getByText("Configure your personal preferences."),
    ).toBeInTheDocument();
  });

  it("should not render dialog when open is false", () => {
    render(<PersonalPreferencesDialog open={false} setOpen={mockSetOpen} />);

    expect(
      screen.queryByRole("dialog", { name: "Personal Preferences" }),
    ).not.toBeInTheDocument();
  });

  it("should render both tabs", () => {
    render(<PersonalPreferencesDialog open={true} setOpen={mockSetOpen} />);

    expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Beta Features" }),
    ).toBeInTheDocument();
  });

  it("should render settings tab content by default", () => {
    render(<PersonalPreferencesDialog open={true} setOpen={mockSetOpen} />);

    expect(screen.getByText("Test Feature")).toBeInTheDocument();
    expect(
      screen.getByText("A test feature for testing purposes."),
    ).toBeInTheDocument();
  });

  it("should render beta features tab content when clicked", async () => {
    const user = userEvent.setup();
    render(<PersonalPreferencesDialog open={true} setOpen={mockSetOpen} />);

    const betaTab = screen.getByRole("tab", { name: "Beta Features" });
    await user.click(betaTab);

    expect(
      await screen.findByText("Code Viewer virtualization"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enable the code viewer virtualization."),
    ).toBeInTheDocument();
  });

  it("should render all flags with correct information in their respective tabs", async () => {
    const user = userEvent.setup();
    render(<PersonalPreferencesDialog open={true} setOpen={mockSetOpen} />);

    expect(screen.getByText("Test Feature")).toBeInTheDocument();
    expect(
      screen.getByText("A test feature for testing purposes."),
    ).toBeInTheDocument();

    const betaTab = screen.getByRole("tab", { name: "Beta Features" });
    await user.click(betaTab);

    expect(
      await screen.findByText("Code Viewer virtualization"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Enable the code viewer virtualization."),
    ).toBeInTheDocument();
  });

  it("should render switches with correct initial states in settings tab", () => {
    render(<PersonalPreferencesDialog open={true} setOpen={mockSetOpen} />);

    const settingsSwitches = screen.getAllByRole("switch");

    expect(settingsSwitches).toHaveLength(1);
    expect(settingsSwitches[0]).toBeChecked();
  });

  it("should render switches with correct initial states in beta features tab", async () => {
    const user = userEvent.setup();
    render(<PersonalPreferencesDialog open={true} setOpen={mockSetOpen} />);

    const betaTab = screen.getByRole("tab", { name: "Beta Features" });
    await user.click(betaTab);

    const betaSwitches = await screen.findAllByRole("switch");

    expect(betaSwitches).toHaveLength(1);
    expect(betaSwitches[0]).not.toBeChecked();
  });

  it("should dispatch setFlag action when settings switch is toggled", async () => {
    const user = userEvent.setup();
    render(<PersonalPreferencesDialog open={true} setOpen={mockSetOpen} />);

    const settingsSwitch = screen.getByTestId("testFeature-switch");
    await user.click(settingsSwitch);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "setFlag",
      payload: {
        key: "testFeature",
        enabled: false,
      },
    });
  });

  it("should dispatch setFlag action when beta switch is toggled", async () => {
    const user = userEvent.setup();
    render(<PersonalPreferencesDialog open={true} setOpen={mockSetOpen} />);

    const betaTab = screen.getByRole("tab", { name: "Beta Features" });
    await user.click(betaTab);

    const betaSwitch = await screen.findByTestId("codeViewer-switch");
    await user.click(betaSwitch);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: "setFlag",
      payload: {
        key: "codeViewer",
        enabled: true,
      },
    });
  });

  it("should render Close button", () => {
    render(<PersonalPreferencesDialog open={true} setOpen={mockSetOpen} />);

    const closeButton = screen.getByTestId("close-button");
    expect(closeButton).toBeInTheDocument();
  });

  it("should call setOpen(false) when Close button is clicked", async () => {
    const user = userEvent.setup();
    render(<PersonalPreferencesDialog open={true} setOpen={mockSetOpen} />);

    const closeButton = screen.getByTestId("close-button");
    await user.click(closeButton);

    expect(mockSetOpen).toHaveBeenCalledWith(false);
  });

  it("should call setOpen when dialog is closed via onOpenChange", async () => {
    const user = userEvent.setup();
    render(<PersonalPreferencesDialog open={true} setOpen={mockSetOpen} />);

    await user.keyboard("{Escape}");

    expect(mockSetOpen).toHaveBeenCalled();
  });

  it("should have proper accessibility attributes", () => {
    render(<PersonalPreferencesDialog open={true} setOpen={mockSetOpen} />);

    const dialog = screen.getByRole("dialog", { name: "Personal Preferences" });
    expect(dialog).toHaveAttribute("aria-label", "Personal Preferences");

    expect(
      screen.getByText("Configure your personal preferences."),
    ).toBeInTheDocument();
  });

  it("should handle empty flags arrays", async () => {
    const user = userEvent.setup();
    mockuseFlagsReducer.mockReturnValue([[], mockDispatch]);

    render(<PersonalPreferencesDialog open={true} setOpen={mockSetOpen} />);

    expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Beta Features" }),
    ).toBeInTheDocument();

    expect(screen.queryAllByRole("switch")).toHaveLength(0);

    const betaTab = screen.getByRole("tab", { name: "Beta Features" });
    await user.click(betaTab);

    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("should maintain consistent dialog structure", () => {
    render(<PersonalPreferencesDialog open={true} setOpen={mockSetOpen} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Personal Preferences")).toBeInTheDocument();
    expect(
      screen.getByText("Configure your personal preferences."),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Settings" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Beta Features" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("close-button")).toBeInTheDocument();
  });
});
