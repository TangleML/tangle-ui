import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ImportPage } from "./index";

const mockNavigate = vi.fn();
let mockSearchParams: { url?: string } = {
  url: "http://127.0.0.1:9999/pipeline.yaml",
};

vi.mock("@tanstack/react-router", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useNavigate: () => mockNavigate,
    useSearch: () => mockSearchParams,
    useRouter: () => ({ navigate: vi.fn() }),
  };
});

vi.mock("@/services/pipelineService", () => ({
  importPipelineFromYaml: vi.fn(),
}));

import { importPipelineFromYaml } from "@/services/pipelineService";

describe("ImportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = { url: "http://127.0.0.1:9999/pipeline.yaml" };
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  test("shows step indicator with all steps on initial render", () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise(() => {}),
    );
    render(<ImportPage />);
    expect(screen.getByText("Importing Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Fetching pipeline")).toBeInTheDocument();
    expect(screen.getByText("Importing into editor")).toBeInTheDocument();
    expect(screen.getByText("Opening editor")).toBeInTheDocument();
  });

  test("progresses through steps and redirects on success", async () => {
    const yamlContent = "name: Test Pipeline\nimplementation: {}";
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(yamlContent),
    });
    (importPipelineFromYaml as ReturnType<typeof vi.fn>).mockResolvedValue({
      successful: true,
      name: "Test Pipeline",
    });

    render(<ImportPage />);

    await waitFor(() => {
      expect(importPipelineFromYaml).toHaveBeenCalledWith(yamlContent, true);
    });

    await waitFor(() => {
      expect(screen.getByText(/Test Pipeline/)).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(mockNavigate).toHaveBeenCalledWith({
          to: "/editor/Test%20Pipeline",
        });
      },
      { timeout: 5000 },
    );
  });

  test("shows error UI when fetch returns non-OK response", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    render(<ImportPage />);

    await waitFor(() => {
      expect(screen.getByText("Import Failed")).toBeInTheDocument();
      expect(
        screen.getByText(/Something went wrong importing the pipeline/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Failed to fetch pipeline: 404 Not Found/),
      ).toBeInTheDocument();
      expect(screen.getByText("← Back to Home")).toBeInTheDocument();
    });
  });

  test("shows error when import returns failure", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("invalid: yaml"),
    });
    (importPipelineFromYaml as ReturnType<typeof vi.fn>).mockResolvedValue({
      successful: false,
      name: "",
      errorMessage: "Invalid pipeline format",
    });

    render(<ImportPage />);

    await waitFor(() => {
      expect(screen.getByText("Import Failed")).toBeInTheDocument();
      expect(screen.getByText(/Invalid pipeline format/)).toBeInTheDocument();
    });
  });

  test("shows error for missing url parameter", async () => {
    mockSearchParams = {};

    render(<ImportPage />);

    await waitFor(() => {
      expect(screen.getByText("Import Failed")).toBeInTheDocument();
      expect(screen.getByText(/Missing 'url' parameter/)).toBeInTheDocument();
    });
  });

  test("shows error when fetched content is empty", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("   "),
    });

    render(<ImportPage />);

    await waitFor(() => {
      expect(screen.getByText("Import Failed")).toBeInTheDocument();
      expect(
        screen.getByText(/The fetched pipeline content is empty/),
      ).toBeInTheDocument();
    });
  });

  test("shows error when fetch throws a network error", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network failure"),
    );

    render(<ImportPage />);

    await waitFor(() => {
      expect(screen.getByText("Import Failed")).toBeInTheDocument();
      expect(screen.getByText(/Network failure/)).toBeInTheDocument();
    });
  });
});
