import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { pipelineMigrationConsentKey } from "@/services/pipelineStorage/pipelineMigrationConsent";

import { PipelineStorageSetting } from "./PipelineStorageSetting";

const backendUrl = "https://backend.example.com";
const notify = vi.hoisted(() => vi.fn());
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl }),
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

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
