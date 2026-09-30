import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSavePipelineToCloud } from "@/hooks/useSavePipelineToCloud";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

import { SavePipelineToCloudButton } from "./SavePipelineToCloudButton";

vi.mock("@/hooks/useSavePipelineToCloud", () => ({
  useSavePipelineToCloud: vi.fn(),
}));

const save = vi.fn();
const file = { displayName: "Daily report" } as PipelineFile;

function mockState(
  overrides: Partial<ReturnType<typeof useSavePipelineToCloud>> = {},
) {
  vi.mocked(useSavePipelineToCloud).mockReturnValue({
    isSupported: true,
    isRetry: false,
    isPending: false,
    save,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockState();
});
afterEach(cleanup);

describe("SavePipelineToCloudButton", () => {
  it("migrates the file without opening its row", () => {
    const open = vi.fn();
    render(
      <div onClick={open}>
        <SavePipelineToCloudButton file={file} />
      </div>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Save to server: Daily report" }),
    );

    expect(save).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    expect(useSavePipelineToCloud).toHaveBeenCalledWith(file);
  });

  it("offers Retry for pending uploads", () => {
    mockState({ isRetry: true });
    render(<SavePipelineToCloudButton file={file} />);
    expect(
      screen.getByRole("button", {
        name: "Retry save to server: Daily report",
      }),
    ).toBeEnabled();
  });

  it("disables duplicate saving and reports progress", () => {
    mockState({ isPending: true });
    render(<SavePipelineToCloudButton file={file} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(save).not.toHaveBeenCalled();
  });

  it("hides unsupported migrations and saved remote entries", () => {
    mockState({ isSupported: false });
    render(<SavePipelineToCloudButton file={file} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
