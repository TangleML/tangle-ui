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
    data: { columns: ArtifactColumn[]; rows: string[][] };
    isFullscreen: boolean;
    totalRows?: number;
    columnCount?: number;
    onDownloadSchema?: () => void;
  }) => (
    <div
      data-testid="table-visualizer"
      data-fullscreen={isFullscreen}
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
  parquetMetadataAsync,
  asyncBufferFromUrl,
  byteLengthFromUrl,
} = await import("hyparquet");
const { downloadStringAsFile } = await import("@/utils/URL");

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

const mockMetadata = (schema: unknown[] = [], numRows = 0) =>
  vi.mocked(parquetMetadataAsync).mockResolvedValue({
    schema,
    num_rows: numRows,
  } as unknown as Awaited<ReturnType<typeof parquetMetadataAsync>>);

beforeEach(() => {
  queryClient.clear();
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
  it("reads metadata via range requests, parses, and renders TableVisualizer with stats", async () => {
    mockMetadata(
      [
        { name: "root", num_children: 2 },
        { name: "name", type: "BYTE_ARRAY", repetition_type: "OPTIONAL" },
        { name: "score", type: "INT64", repetition_type: "REQUIRED" },
      ],
      12345,
    );
    vi.mocked(parquetReadObjects).mockResolvedValue([
      { name: "Alice", score: 100 },
      { name: "Bob", score: 90 },
    ]);

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
      expect(table).toHaveAttribute("data-total-rows", "12345");
      expect(table).toHaveAttribute("data-column-count", "2");
    });

    // Never downloads the whole file; reads only the top 100 preview rows.
    expect(vi.mocked(parquetReadObjects)).toHaveBeenCalledWith(
      expect.objectContaining({ rowEnd: 101 }),
    );
  });

  it("downloads a clean schema JSON when requested", async () => {
    mockMetadata(
      [
        { name: "root", num_children: 2 },
        { name: "id", type: "INT64", repetition_type: "REQUIRED" },
        {
          name: "label",
          type: "BYTE_ARRAY",
          repetition_type: "OPTIONAL",
          logical_type: { type: "STRING" },
        },
      ],
      5,
    );
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

  it("renders error boundary when the fetch layer fails", async () => {
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
    mockMetadata([], 0);
    vi.mocked(parquetReadObjects).mockResolvedValue([]);

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
    mockMetadata(
      [
        { name: "root", num_children: 1 },
        { name: "col", type: "BYTE_ARRAY", repetition_type: "OPTIONAL" },
      ],
      1,
    );
    vi.mocked(parquetReadObjects).mockResolvedValue([{ col: "val" }]);

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
    mockMetadata(
      [
        { name: "root", num_children: 2 },
        { name: "id", type: "INT64", repetition_type: "REQUIRED" },
        {
          name: "label",
          type: "BYTE_ARRAY",
          repetition_type: "OPTIONAL",
          logical_type: { type: "STRING" },
        },
      ],
      1,
    );
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
