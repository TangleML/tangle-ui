import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewPipelineButton from "./NewPipelineButton";

const { createPipeline, navigate, notify } = vi.hoisted(() => ({
  createPipeline: vi.fn(),
  navigate: vi.fn(),
  notify: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: () => ({ createPipeline }),
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));
vi.mock("random-words", () => ({
  generate: () => ["a", "new", "test", "pipeline"],
}));

beforeEach(() => vi.resetAllMocks());

describe("NewPipelineButton", () => {
  it.each([
    ["remote:server:123", "/editor-v2/123"],
    ["pending:server:123", "/editor-v2/pending%3Aserver%3A123"],
  ])("opens the returned %s identity", async (referenceId, route) => {
    createPipeline.mockResolvedValue({ referenceId });
    render(<NewPipelineButton />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: route,
        }),
      ),
    );
    expect(createPipeline).toHaveBeenCalledWith(
      "a new test pipeline",
      expect.stringContaining("a new test pipeline"),
    );
  });

  it("prevents duplicate creation while waiting", async () => {
    let finish!: (value: { referenceId: string }) => void;
    createPipeline.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<NewPipelineButton />);

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toBeDisabled();
    fireEvent.click(screen.getByRole("button"));
    expect(createPipeline).toHaveBeenCalledOnce();
    await act(async () => finish({ referenceId: "pending:test:123" }));
  });

  it("keeps the user on the list and reports creation failure", async () => {
    createPipeline.mockRejectedValue(new Error("Storage unavailable"));
    render(<NewPipelineButton />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        "Could not create pipeline: Storage unavailable",
        "error",
      ),
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toBeEnabled();
  });
});
