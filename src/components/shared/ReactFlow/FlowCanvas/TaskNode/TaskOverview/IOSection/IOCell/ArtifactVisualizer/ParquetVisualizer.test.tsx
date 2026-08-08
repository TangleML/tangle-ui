import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { type ReactElement, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArtifactFetchError } from "@/services/executionService";

import ParquetVisualizer from "./ParquetVisualizer";
import type { ArtifactColumn } from "./utils";

vi.mock("hyparquet", () => ({
  parquetReadObjects: vi.fn(),
  parquetMetadata: vi.fn(),
  parquetMetadataAsync: vi.fn(),
  asyncBufferFromUrl: vi.fn(),
  byteLengthFromUrl: vi.fn(),
  cachedAsyncBuffer: vi.fn((buffer) => buffer),
  toJson: vi.fn((value) => value),
}));

vi.mock("@/utils/URL", () => ({
  downloadStringAsFile: vi.fn(),
}));

vi.mock("./TableVisualizer", () => ({
  default: ({
    data,
    isFullscreen,
    totalRows,
    columnCount,
    onDownloadSchema,
  }: {
    data: { columns: ArtifactColumn[]; rows: string[][]; hasMore: boolean };
    isFullscreen: boolean;
    totalRows?: number;
    columnCount?: number;
    onDownloadSchema?: () => void;
  }) => (
    <div
      data-testid="table-visualizer"
      data-fullscreen={isFullscreen}
      data-has-more={data.hasMore}
      data-headers={data.columns.map((c) => c.name).join(",")}
      data-row-count={data.rows.length}
      data-columns={JSON.stringify(data.columns)}
      data-total-rows={totalRows}
      data-column-count={columnCount}
    >
      <button type="button" onClick={onDownloadSchema}>
        Download schema
      </button>
    </div>
  ),
}));

const {
  parquetReadObjects,
  parquetMetadata,
  parquetMetadataAsync,
  asyncBufferFromUrl,
  byteLengthFromUrl,
} = await import("hyparquet");
const { downloadStringAsFile } = await import("@/utils/URL");

const SCHEMA = [
  { name: "root", num_children: 2 },
  { name: "name", type: "BYTE_ARRAY", repetition_type: "OPTIONAL" },
  { name: "score", type: "INT64", repetition_type: "REQUIRED" },
];

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithSuspense = (ui: ReactElement) =>
  render(
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary
        fallbackRender={({ error }) => (
          <div data-testid="error">
            {error instanceof Error ? error.message : "Unknown error"}
          </div>
        )}
      >
        <Suspense fallback={<div data-testid="loading">Loading</div>}>
          {ui}
        </Suspense>
      </ErrorBoundary>
    </QueryClientProvider>,
  );

/** Range-backed reads: `parquetReadObjects` slices a synthetic dataset. */
const mockDataset = (schema: unknown[], numRows: number) => {
  vi.mocked(parquetMetadataAsync).mockResolvedValue({
    schema,
    num_rows: numRows,
  } as unknown as Awaited<ReturnType<typeof parquetMetadataAsync>>);
  vi.mocked(parquetReadObjects).mockImplementation(
    async ({ rowStart = 0, rowEnd }) => {
      const end = Math.min(rowEnd ?? numRows, numRows);
      return Array.from({ length: Math.max(0, end - rowStart) }, (_, i) => ({
        name: `row-${rowStart + i}`,
        score: (rowStart + i) * 10,
      }));
    },
  );
};

beforeEach(() => {
  queryClient.clear();
  vi.restoreAllMocks();
  vi.mocked(parquetMetadata).mockReset();
  vi.mocked(parquetMetadataAsync).mockReset();
  vi.mocked(parquetReadObjects).mockReset();
  vi.mocked(downloadStringAsFile).mockReset();
  vi.mocked(byteLengthFromUrl).mockResolvedValue(1024);
  vi.mocked(asyncBufferFromUrl).mockResolvedValue({
    byteLength: 1024,
    slice: vi.fn(),
  } as unknown as Awaited<ReturnType<typeof asyncBufferFromUrl>>);
});

describe("ParquetVisualizer", () => {
  it("reads via range requests, parses, and renders TableVisualizer with stats", async () => {
    mockDataset(SCHEMA, 2);

    renderWithSuspense(
      <ParquetVisualizer
        signedUrl="https://storage.example.com/data.parquet"
        isFullscreen={false}
      />,
    );

    await waitFor(() => {
      const table = screen.getByTestId("table-visualizer");
      expect(table).toHaveAttribute("data-headers", "name,score");
      expect(table).toHaveAttribute("data-row-count", "2");
      expect(table).toHaveAttribute("data-total-rows", "2");
      expect(table).toHaveAttribute("data-column-count", "2");
      expect(table).toHaveAttribute("data-has-more", "false");
    });

    // Only the top preview rows are read, never the whole file up front.
    expect(vi.mocked(parquetReadObjects)).toHaveBeenCalledWith(
      expect.objectContaining({ rowEnd: 100 }),
    );
  });

  it("previews the top rows and reports more remain for a large file", async () => {
    mockDataset(SCHEMA, 2500);

    renderWithSuspense(
      <ParquetVisualizer
        signedUrl="https://storage.example.com/big.parquet"
        isFullscreen={false}
      />,
    );

    await waitFor(() => {
      const table = screen.getByTestId("table-visualizer");
      expect(table).toHaveAttribute("data-row-count", "100");
      expect(table).toHaveAttribute("data-total-rows", "2500");
      expect(table).toHaveAttribute("data-has-more", "true");
    });
  });

  const mockFullDownload = (contentLength: string | null) =>
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => contentLength },
      arrayBuffer: async () => new ArrayBuffer(1024),
    } as unknown as Response);

  it("falls back to a full download when range requests are unavailable", async () => {
    // Simulate a CORS/network failure on the range path (not an HTTP error).
    vi.mocked(byteLengthFromUrl).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    mockFullDownload(String(1024));
    vi.mocked(parquetMetadata).mockReturnValue({
      schema: SCHEMA,
      num_rows: 1,
    } as unknown as ReturnType<typeof parquetMetadata>);
    vi.mocked(parquetReadObjects).mockResolvedValue([
      { name: "Alice", score: 100 },
    ]);

    renderWithSuspense(
      <ParquetVisualizer
        signedUrl="https://storage.example.com/no-range.parquet"
        isFullscreen={false}
      />,
    );

    await waitFor(() => {
      const table = screen.getByTestId("table-visualizer");
      expect(table).toHaveAttribute("data-row-count", "1");
      expect(table).toHaveAttribute("data-total-rows", "1");
    });
  });

  it("errors instead of downloading a huge file when range requests are unavailable", async () => {
    vi.mocked(byteLengthFromUrl).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    // 200 MB — well past the full-download cap.
    mockFullDownload(String(200 * 1024 * 1024));

    renderWithSuspense(
      <ParquetVisualizer
        signedUrl="https://storage.example.com/huge.parquet"
        isFullscreen={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByText(/too large to preview/i)).toBeInTheDocument();
    });
  });

  it("errors instead of downloading when Content-Length is absent", async () => {
    vi.mocked(byteLengthFromUrl).mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    // No Content-Length header — size is unknown, so we must not download.
    mockFullDownload(null);

    renderWithSuspense(
      <ParquetVisualizer
        signedUrl="https://storage.example.com/no-length.parquet"
        isFullscreen={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByText(/too large to preview/i)).toBeInTheDocument();
    });
  });

  it("downloads a clean schema JSON when requested", async () => {
    vi.mocked(parquetMetadataAsync).mockResolvedValue({
      schema: [
        { name: "root", num_children: 2 },
        { name: "id", type: "INT64", repetition_type: "REQUIRED" },
        {
          name: "label",
          type: "BYTE_ARRAY",
          repetition_type: "OPTIONAL",
          logical_type: { type: "STRING" },
        },
      ],
      num_rows: 5,
    } as unknown as Awaited<ReturnType<typeof parquetMetadataAsync>>);
    vi.mocked(parquetReadObjects).mockResolvedValue([{ id: 1, label: "a" }]);

    renderWithSuspense(
      <ParquetVisualizer
        signedUrl="https://storage.example.com/data.parquet"
        isFullscreen={false}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("table-visualizer")).toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Download schema" }),
    );

    expect(vi.mocked(downloadStringAsFile)).toHaveBeenCalledOnce();
    const [content, filename, contentType] =
      vi.mocked(downloadStringAsFile).mock.calls[0];
    expect(filename).toBe("schema.json");
    expect(contentType).toBe("application/json");
    expect(JSON.parse(content)).toEqual({
      num_rows: 5,
      num_columns: 2,
      columns: [
        {
          name: "id",
          type: "INT64",
          repetition_type: "REQUIRED",
          nullable: false,
        },
        {
          name: "label",
          type: "STRING",
          logical_type: { type: "STRING" },
          repetition_type: "OPTIONAL",
          nullable: true,
        },
      ],
    });
  });

  it("surfaces artifact failures to the error boundary", async () => {
    vi.mocked(byteLengthFromUrl).mockRejectedValue(
      new ArtifactFetchError(500, "Server Error", "Failed to fetch artifact."),
    );

    renderWithSuspense(
      <ParquetVisualizer
        signedUrl="https://storage.example.com/broken.parquet"
        isFullscreen={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch artifact/)).toBeInTheDocument();
    });
  });

  it("shows 'No data' for empty parquet files", async () => {
    mockDataset([], 0);

    renderWithSuspense(
      <ParquetVisualizer
        signedUrl="https://storage.example.com/empty.parquet"
        isFullscreen={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("No data")).toBeInTheDocument();
    });
  });

  it("passes isFullscreen to TableVisualizer", async () => {
    mockDataset(
      [
        { name: "root", num_children: 1 },
        { name: "name", type: "BYTE_ARRAY", repetition_type: "OPTIONAL" },
      ],
      1,
    );

    renderWithSuspense(
      <ParquetVisualizer
        signedUrl="https://storage.example.com/data.parquet"
        isFullscreen={true}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("table-visualizer")).toHaveAttribute(
        "data-fullscreen",
        "true",
      );
    });
  });

  it("attaches schema-derived type and nullable flags to each column", async () => {
    vi.mocked(parquetMetadataAsync).mockResolvedValue({
      schema: [
        { name: "root", num_children: 2 },
        { name: "id", type: "INT64", repetition_type: "REQUIRED" },
        {
          name: "label",
          type: "BYTE_ARRAY",
          repetition_type: "OPTIONAL",
          logical_type: { type: "STRING" },
        },
      ],
      num_rows: 1,
    } as unknown as Awaited<ReturnType<typeof parquetMetadataAsync>>);
    vi.mocked(parquetReadObjects).mockResolvedValue([{ id: 1, label: "a" }]);

    renderWithSuspense(
      <ParquetVisualizer
        signedUrl="https://storage.example.com/data.parquet"
        isFullscreen={false}
      />,
    );

    await waitFor(() => {
      const table = screen.getByTestId("table-visualizer");
      const columns = JSON.parse(table.getAttribute("data-columns") ?? "[]");
      expect(columns).toEqual([
        { name: "id", type: "INT64", nullable: false },
        { name: "label", type: "STRING", nullable: true },
      ]);
    });
  });
});
