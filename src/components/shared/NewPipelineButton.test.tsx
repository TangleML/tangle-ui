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
  configured: true,
  ready: true,
  navigate: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => state.navigate,
}));
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({
    ready: state.ready,
    configured: state.configured,
    backendUrl: "https://backend.example.com",
  }),
}));
vi.mock("@/hooks/useToastNotification", () => ({
  default: () => state.notify,
}));
vi.mock("random-words", () => ({ generate: () => ["New", "pipeline"] }));

beforeEach(() => {
  vi.resetAllMocks();
  state.configured = true;
  state.ready = true;
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("opens an unsaved remote draft with a stable identity", async () => {
  render(<NewPipelineButton />);
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(state.navigate).toHaveBeenCalledOnce());
  expect(state.navigate).toHaveBeenCalledWith({
    to: "/editor/new/pipeline",
    state: {
      newPipeline: {
        name: "New pipeline",
        draftId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      },
    },
  });
});

it.each(["ctrlKey", "metaKey"])("opens a draft in a new tab with %s", (key) => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  render(<NewPipelineButton />);
  fireEvent.click(screen.getByRole("button"), { [key]: true });
  expect(open).toHaveBeenCalledWith("/editor/new/pipeline", "_blank");
  expect(state.navigate).not.toHaveBeenCalled();
});

it("requires a configured backend before creating a pipeline", () => {
  state.configured = false;
  render(<NewPipelineButton />);
  fireEvent.click(screen.getByRole("button"));
  expect(state.notify).toHaveBeenCalledWith(
    "Configure a backend in Settings to create pipelines.",
    "error",
  );
  expect(state.navigate).not.toHaveBeenCalled();
});

it("waits for backend settings before creating a pipeline", () => {
  state.ready = false;
  state.configured = false;
  render(<NewPipelineButton />);
  fireEvent.click(screen.getByRole("button"));
  expect(state.notify).toHaveBeenCalledWith(
    "Backend settings are loading. Try again shortly.",
    "error",
  );
  expect(state.navigate).not.toHaveBeenCalled();
});
