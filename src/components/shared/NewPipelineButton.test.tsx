import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import NewPipelineButton from "./NewPipelineButton";

const state = vi.hoisted(() => ({
  v2Enabled: true,
  configured: true,
  navigate: vi.fn(),
  notify: vi.fn(),
  write: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => state.navigate,
}));
vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: () => state.v2Enabled,
  isFlagEnabled: () => true,
}));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    ready: true,
    configured: state.configured,
    backendUrl: "https://backend.example.com",
  }),
}));
vi.mock("@/hooks/useToastNotification", () => ({
  default: () => state.notify,
}));
vi.mock("@/utils/componentStore", () => ({
  writeComponentToFileListFromText: state.write,
}));
vi.mock("random-words", () => ({ generate: () => ["New", "pipeline"] }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VITE_LOCAL_PIPELINES", undefined);
  state.v2Enabled = true;
  state.configured = true;
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it.each([undefined, "false", "true"])(
  "uses VITE_LOCAL_PIPELINES=%s for the shared New Pipeline button",
  async (value) => {
    vi.stubEnv("VITE_LOCAL_PIPELINES", value);
    const enabled = value !== "true";
    render(<NewPipelineButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(state.navigate).toHaveBeenCalledOnce());
    expect(state.write).toHaveBeenCalledTimes(enabled ? 0 : 1);
    expect(state.navigate).toHaveBeenCalledWith(
      enabled
        ? {
            to: "/editor-v2/new/pipeline",
            state: {
              newPipeline: {
                name: "New pipeline",
                draftId: expect.stringMatching(/^[0-9a-f-]{36}$/),
              },
            },
          }
        : { to: "/editor-v2/New%20pipeline", reloadDocument: true },
    );
  },
);

it.each(["ctrlKey", "metaKey"])(
  "opens a draft in a new tab with %s",
  async (key) => {
    vi.stubEnv("VITE_LOCAL_PIPELINES", undefined);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<NewPipelineButton />);
    fireEvent.click(screen.getByRole("button"), { [key]: true });
    expect(open).toHaveBeenCalledWith("/editor-v2/new/pipeline", "_blank");
    expect(state.write).not.toHaveBeenCalled();
    expect(state.navigate).not.toHaveBeenCalled();
  },
);

it("requires backend configuration when remote creation is enabled", async () => {
  vi.stubEnv("VITE_LOCAL_PIPELINES", undefined);
  state.configured = false;
  render(<NewPipelineButton />);
  fireEvent.click(screen.getByRole("button"));
  expect(state.notify).toHaveBeenCalledWith(
    expect.stringContaining("Configure a backend"),
    "error",
  );
  expect(state.write).not.toHaveBeenCalled();
  expect(state.navigate).not.toHaveBeenCalled();
});

it("requires the V2 editor when remote creation is enabled", () => {
  vi.stubEnv("VITE_LOCAL_PIPELINES", undefined);
  state.v2Enabled = false;
  render(<NewPipelineButton />);
  fireEvent.click(screen.getByRole("button"));
  expect(state.notify).toHaveBeenCalledWith(
    "Enable the V2 editor to create remote pipelines.",
    "error",
  );
  expect(state.write).not.toHaveBeenCalled();
  expect(state.navigate).not.toHaveBeenCalled();
});
