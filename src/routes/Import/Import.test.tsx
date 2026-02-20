import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { importPipelineFromYaml } from "@/services/pipelineService";

import { ImportPage, isAllowedImportUrl } from "./index";

const mockNavigate = vi.fn();
const mockRouterNavigate = vi.fn();
let mockSearchParams: { url?: string } = {
  url: "http://127.0.0.1:54321/tangle-deploy/pipeline.yaml",
};

vi.mock("@tanstack/react-router", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useNavigate: () => mockNavigate,
    useSearch: () => mockSearchParams,
    useRouter: () => ({ navigate: mockRouterNavigate }),
  };
});

vi.mock("@/services/pipelineService", () => ({
  importPipelineFromYaml: vi.fn(),
}));

describe("isAllowedImportUrl", () => {
  test("accepts valid localhost URL with high port", () => {
    expect(
      isAllowedImportUrl("http://127.0.0.1:54321/tangle-deploy/pipeline.yaml"),
    ).toBe(true);
  });

  test("accepts minimum allowed port", () => {
    expect(
      isAllowedImportUrl("http://127.0.0.1:10000/tangle-deploy/pipeline.yaml"),
    ).toBe(true);
  });

  test("rejects wrong scheme (https)", () => {
    expect(
      isAllowedImportUrl("https://127.0.0.1:54321/tangle-deploy/pipeline.yaml"),
    ).toBe(false);
  });

  test("rejects wrong host", () => {
    expect(
      isAllowedImportUrl("http://evil.com:54321/tangle-deploy/pipeline.yaml"),
    ).toBe(false);
  });

  test("rejects localhost hostname (must be 127.0.0.1)", () => {
    expect(
      isAllowedImportUrl("http://localhost:54321/tangle-deploy/pipeline.yaml"),
    ).toBe(false);
  });

  test("rejects port below minimum", () => {
    expect(
      isAllowedImportUrl("http://127.0.0.1:6379/tangle-deploy/pipeline.yaml"),
    ).toBe(false);
  });

  test("rejects missing port", () => {
    expect(
      isAllowedImportUrl("http://127.0.0.1/tangle-deploy/pipeline.yaml"),
    ).toBe(false);
  });

  test("rejects wrong path", () => {
    expect(isAllowedImportUrl("http://127.0.0.1:54321/pipeline.yaml")).toBe(
      false,
    );
  });

  test("rejects malformed URL", () => {
    expect(isAllowedImportUrl("not-a-url")).toBe(false);
  });

  test("rejects empty string", () => {
    expect(isAllowedImportUrl("")).toBe(false);
  });
});

describe("ImportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = {
      url: "http://127.0.0.1:54321/tangle-deploy/pipeline.yaml",
    };
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  test("shows confirmation screen with URL before fetching", () => {
    render(<ImportPage />);
    expect(screen.getByTestId("import-confirm-button")).toHaveTextContent(
      "Import Pipeline",
    );
    expect(screen.getByText(/127\.0\.0\.1:54321/)).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("fetches and imports after clicking confirm button", async () => {
    const user = userEvent.setup();
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

    await user.click(screen.getByTestId("import-confirm-button"));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:54321/tangle-deploy/pipeline.yaml",
      );
    });

    await waitFor(() => {
      expect(importPipelineFromYaml).toHaveBeenCalledWith(yamlContent, true);
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({
        to: "/editor/Test%20Pipeline",
      });
    });
  });

  test("shows error UI when fetch returns non-OK response", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    render(<ImportPage />);
    await user.click(screen.getByTestId("import-confirm-button"));

    await waitFor(() => {
      expect(screen.getByText("Import Failed")).toBeInTheDocument();
      expect(
        screen.getByText(/Failed to fetch pipeline: 404 Not Found/),
      ).toBeInTheDocument();
    });
  });

  test("shows error when import returns failure", async () => {
    const user = userEvent.setup();
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
    await user.click(screen.getByTestId("import-confirm-button"));

    await waitFor(() => {
      expect(screen.getByText("Import Failed")).toBeInTheDocument();
      expect(screen.getByText(/Invalid pipeline format/)).toBeInTheDocument();
    });
  });

  test("shows error for missing url parameter", () => {
    mockSearchParams = {};

    render(<ImportPage />);

    expect(screen.getByText("Import Failed")).toBeInTheDocument();
    expect(screen.getByText(/URL must be/)).toBeInTheDocument();
  });

  test("shows error for invalid URL (wrong host)", () => {
    mockSearchParams = {
      url: "http://evil.com:54321/tangle-deploy/pipeline.yaml",
    };

    render(<ImportPage />);

    expect(screen.getByText("Import Failed")).toBeInTheDocument();
    expect(screen.getByText(/URL must be/)).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("shows error for invalid URL (port too low)", () => {
    mockSearchParams = {
      url: "http://127.0.0.1:80/tangle-deploy/pipeline.yaml",
    };

    render(<ImportPage />);

    expect(screen.getByText("Import Failed")).toBeInTheDocument();
    expect(screen.getByText(/URL must be/)).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("shows error for invalid URL (wrong path)", () => {
    mockSearchParams = { url: "http://127.0.0.1:54321/some-other-path" };

    render(<ImportPage />);

    expect(screen.getByText("Import Failed")).toBeInTheDocument();
    expect(screen.getByText(/URL must be/)).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("shows error when fetched content is empty", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("   "),
    });

    render(<ImportPage />);
    await user.click(screen.getByTestId("import-confirm-button"));

    await waitFor(() => {
      expect(screen.getByText("Import Failed")).toBeInTheDocument();
      expect(
        screen.getByText(/The fetched pipeline content is empty/),
      ).toBeInTheDocument();
    });
  });

  test("shows error when fetch throws a network error", async () => {
    const user = userEvent.setup();
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network failure"),
    );

    render(<ImportPage />);
    await user.click(screen.getByTestId("import-confirm-button"));

    await waitFor(() => {
      expect(screen.getByText("Import Failed")).toBeInTheDocument();
      expect(screen.getByText(/Network failure/)).toBeInTheDocument();
    });
  });

  test("cancel button navigates home", async () => {
    const user = userEvent.setup();
    render(<ImportPage />);
    await user.click(screen.getByText("Cancel"));

    expect(mockRouterNavigate).toHaveBeenCalledWith({ to: "/" });
  });
});
