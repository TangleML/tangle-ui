import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ArtifactPreviewPage from "./ArtifactPreview";

const mockParams = vi.hoisted(() => vi.fn());
const mockSearch = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
    "@tanstack/react-router",
  );
  return {
    ...actual,
    useParams: (...args: unknown[]) => mockParams(...args),
    useSearch: (...args: unknown[]) => mockSearch(...args),
  };
});

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "http://localhost:8000" }),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock("@/services/executionService", () => ({
  getArtifactInfo: vi.fn(),
  getArtifactSignedUrl: vi.fn().mockResolvedValue({
    signed_url: "https://storage.example.com/signed",
  }),
  ArtifactFetchError: class extends Error {
    status: number;
    statusText: string;
    constructor(status: number, statusText: string, message: string) {
      super(message);
      this.status = status;
      this.statusText = statusText;
    }
  },
}));

vi.mock(
  "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/IOSection/IOCell/ArtifactVisualizer/ArtifactPreviewContent",
  async () => {
    const actual = await vi.importActual<
      typeof import("@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/IOSection/IOCell/ArtifactVisualizer/ArtifactPreviewContent")
    >(
      "@/components/shared/ReactFlow/FlowCanvas/TaskNode/TaskOverview/IOSection/IOCell/ArtifactVisualizer/ArtifactPreviewContent",
    );
    return {
      ...actual,
      PreviewContent: ({
        type,
        artifactId,
        name,
        isFullscreen,
      }: {
        type: string;
        artifactId: string;
        name: string;
        isFullscreen: boolean;
      }) => (
        <div
          data-testid="preview-content"
          data-type={type}
          data-artifact-id={artifactId}
          data-name={name}
          data-fullscreen={isFullscreen}
        />
      ),
    };
  },
);

const { getArtifactInfo } = await import("@/services/executionService");

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderPage = (ui: ReactElement) =>
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

beforeEach(() => {
  queryClient.clear();
  mockParams.mockReset();
  mockSearch.mockReset();
  vi.mocked(getArtifactInfo).mockReset();
});

describe("ArtifactPreviewPage", () => {
  it("uses the search-param type when provided", async () => {
    mockParams.mockReturnValue({ artifactId: "abc" });
    mockSearch.mockReturnValue({ type: "Apache Parquet", name: "output" });
    vi.mocked(getArtifactInfo).mockResolvedValue({
      id: "abc",
      artifact_data: {
        total_size: 100,
        is_dir: false,
        uri: "gs://bucket/x",
        hash: "",
      },
    });

    renderPage(<ArtifactPreviewPage />);

    await waitFor(() => {
      const preview = screen.getByTestId("preview-content");
      expect(preview).toHaveAttribute("data-type", "apacheparquet");
      expect(preview).toHaveAttribute("data-artifact-id", "abc");
      expect(preview).toHaveAttribute("data-name", "output");
      expect(preview).toHaveAttribute("data-fullscreen", "true");
    });
  });

  it("falls back to URI extension when search param type is missing", async () => {
    mockParams.mockReturnValue({ artifactId: "abc" });
    mockSearch.mockReturnValue({});
    vi.mocked(getArtifactInfo).mockResolvedValue({
      id: "abc",
      artifact_data: {
        total_size: 100,
        is_dir: false,
        uri: "gs://bucket/output_table.parquet",
        hash: "",
      },
    });

    renderPage(<ArtifactPreviewPage />);

    await waitFor(() => {
      expect(screen.getByTestId("preview-content")).toHaveAttribute(
        "data-type",
        "apacheparquet",
      );
    });
  });

  it("falls back to artifactId when name is missing", async () => {
    mockParams.mockReturnValue({ artifactId: "abc-123" });
    mockSearch.mockReturnValue({ type: "csv" });
    vi.mocked(getArtifactInfo).mockResolvedValue({
      id: "abc-123",
      artifact_data: {
        total_size: 100,
        is_dir: false,
        uri: "gs://bucket/x",
        hash: "",
      },
    });

    renderPage(<ArtifactPreviewPage />);

    await waitFor(() => {
      expect(screen.getByTestId("preview-content")).toHaveAttribute(
        "data-name",
        "abc-123",
      );
    });
  });

  it("renders a Share button on the preview page", async () => {
    mockParams.mockReturnValue({ artifactId: "abc" });
    mockSearch.mockReturnValue({ type: "csv", name: "output" });
    vi.mocked(getArtifactInfo).mockResolvedValue({
      id: "abc",
      artifact_data: {
        total_size: 100,
        is_dir: false,
        uri: "gs://bucket/x",
        hash: "",
      },
    });

    renderPage(<ArtifactPreviewPage />);

    await waitFor(() => {
      expect(screen.getByText("Share")).toBeInTheDocument();
    });
  });

  it("shows an unsupported type message for non-visualizable types", async () => {
    mockParams.mockReturnValue({ artifactId: "abc" });
    mockSearch.mockReturnValue({ type: "binary" });
    vi.mocked(getArtifactInfo).mockResolvedValue({
      id: "abc",
      artifact_data: {
        total_size: 100,
        is_dir: false,
        uri: "gs://bucket/x",
        hash: "",
      },
    });

    renderPage(<ArtifactPreviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/Unsupported artifact type/)).toBeInTheDocument();
    });
  });
});
