import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { pipelineMigrationConsentKey } from "@/services/pipelineStorage/pipelineMigrationConsent";

import { PipelineStorageSetting } from "./PipelineStorageSetting";

const backendUrl = "https://backend.example.com";
const notify = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ configured: true }));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl, configured: state.configured }),
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));
beforeEach(() => {
  vi.stubEnv("VITE_REMOTE_PIPELINES", "true");
  state.configured = true;
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

it.each(["not enabled", "no backend"])(
  "explains why browser storage is enforced with %s",
  (mode) => {
    if (mode === "not enabled") vi.stubEnv("VITE_REMOTE_PIPELINES", undefined);
    else state.configured = false;
    render(<PipelineStorageSetting />);
    expect(screen.getByRole("switch")).toBeChecked();
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(
      screen.getByText(
        mode === "not enabled"
          ? /not enabled for this deployment/
          : /until a backend is configured/,
      ),
    ).toBeInTheDocument();
  },
);

it("revokes automatic migration only for the selected backend", () => {
  const key = pipelineMigrationConsentKey(backendUrl);
  const other = pipelineMigrationConsentKey("https://other.example.com");
  localStorage.setItem(key, "true");
  localStorage.setItem(other, "true");
  render(<PipelineStorageSetting />);
  fireEvent.click(
    screen.getByRole("button", {
      name: "Ask before moving pipelines to this backend",
    }),
  );
  expect(localStorage.getItem(key)).toBeNull();
  expect(localStorage.getItem(other)).toBe("true");
  expect(notify).toHaveBeenCalledWith(
    "You'll be asked before moving pipelines to this backend.",
    "success",
  );
});
