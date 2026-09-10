import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { type ReactElement, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { beforeEach, describe, expect, it, vi } from "vitest";

import useToastNotification from "@/hooks/useToastNotification";

import { PARQUET_PREVIEW_ROWS } from "./parquetUtils";
import ParquetVisualizer from "./ParquetVisualizer";
import { type ArtifactColumn, getPreviewRowLimit } from "./utils";

type DownloadFull = { filename: string; getBlob: () => Promise<Blob> };

// Captures the `downloadFull` prop so tests can exercise its `getBlob` contract.
let lastDownloadFull: DownloadFull | undefined;

vi.mock("hyparquet", () => ({
  parquetReadObjects: vi.fn(),
  parquetMetadata: vi.fn(),
  parquetMetadataAsync: vi.fn(),
  asyncBufferFromUrl: vi.fn(),
  cachedAsyncBuffer: vi.fn((buffer) => buffer),
  toJson: vi.fn((value) => value),
}));

vi.mock("@/utils/URL", () => ({
  downloadStringAsFile: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification");

const mockNotify = vi.fn();

vi.mock("./TableVisualizer", () => ({
  default: ({
    data,
    isFullscreen,
    isLoading,
    totalRows,
    columnCount,
    onDownloadSchema,
    onLoadMore,
    onLoadAll,
    downloadFull,
  }: {
    data: { columns: ArtifactColumn[]; rows: string[][]; hasMore: boolean };
    isFullscreen: boolean;
    isLoading?: boolean;
    totalRows?: number;
    columnCount?: number;
    onDownloadSchema?: () => void;
    onLoadMore?: () => void;
    onLoadAll?: () => void;
    downloadFull?: DownloadFull;
  }) => {
    lastDownloadFull = downloadFull;
    return (
      <div
        data-testid="table-visualizer"
        data-fullscreen={isFullscreen}
        data-loading={isLoading}
        data-has-more={data.hasMore}
        data-headers={data.columns.map((c) => c.name).join(",")}
        data-row-count={data.rows.length}
        data-columns={JSON.stringify(data.columns)}
        data-total-rows={totalRows}
        data-column-count={columnCount}
        data-download-filename={downloadFull?.filename}
      >
        <button type="button" onClick={onDownloadSchema}>
          Download schema
        </button>
        {onLoadMore && (
          <button type="button" onClick={onLoadMore}>
            Load more
          </button>
        )}
        {onLoadAll && (
          <button type="button" onClick={onLoadAll}>
            Load max
          </button>
        )}
      </div>
    );
  },
}));

const {
  parquetReadObjects,
  parquetMetadata,
  parquetMetadataAsync,
  asyncBufferFromUrl,
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

/** Same as `mockDataset`, but with `columnCount` generated columns per row. */
const mockWideDataset = (columnCount: number, numRows: number) => {
  const names = Array.from({ length: columnCount }, (_, i) => `col_${i}`);
  vi.mocked(parquetMetadataAsync).mockResolvedValue({
    schema: [
      { name: "root", num_children: columnCount },
      ...names.map((name) => ({
        name,
        type: "INT64",
        repetition_type: "REQUIRED",
      })),
    ],
    num_rows: numRows,
  } as unknown as Awaited<ReturnType<typeof parquetMetadataAsync>>);
  vi.mocked(parquetReadObjects).mockImplementation(
    async ({ rowStart = 0, rowEnd }) => {
      const end = Math.min(rowEnd ?? numRows, numRows);
      return Array.from({ length: Math.max(0, end - rowStart) }, (_, i) =>
        Object.fromEntries(names.map((name) => [name, rowStart + i])),
      );
    },
  );
};

/** A `Range: bytes=0-0` probe answered with the total size, as object stores do. */
const mockRangeProbe = (totalSize: number) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 206,
    headers: new Headers({ "Content-Range": `bytes 0-0/${totalSize}` }),
  } as unknown as Response);

beforeEach(() => {
  queryClient.clear();
  lastDownloadFull = undefined;
  vi.restoreAllMocks();
  mockNotify.mockReset();
  vi.mocked(useToastNotification).mockReturnValue(mockNotify);
  vi.mocked(parquetMetadata).mockReset();
  vi.mocked(parquetMetadataAsync).mockReset();
  vi.mocked(parquetReadObjects).mockReset();
  vi.mocked(downloadStringAsFile).mockReset();
  mockRangeProbe(1024);
  vi.mocked(asyncBufferFromUrl).mockResolvedValue({
    byteLength: 1024,
    slice: vi.fn(),
  } as unknown as Awaited<ReturnType<typeof asyncBufferFromUrl>>);
});

describe("ParquetVisualizer", () => {
  it("opens the file at the reported size without any size request", async () => {
    const fetchSpy = mockRangeProbe(1024);
    mockDataset(SCHEMA, 2);

    renderWithSuspense(
      <ParquetVisualizer
        signedUrl="https://storage.example.com/sized.parquet"
        isFullscreen={false}
        byteLength={9446073}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("table-visualizer")).toBeInTheDocument(),
    );

    expect(vi.mocked(asyncBufferFromUrl)).toHaveBeenCalledWith(
      expect.objectContaining({ byteLength: 9446073 }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("probes the size with a ranged GET, never a HEAD, when none is reported", async () => {
    const fetchSpy = mockRangeProbe(9446073);
    mockDataset(SCHEMA, 2);

    renderWithSuspense(
      <ParquetVisualizer
        signedUrl="https://storage.example.com/unsized.parquet"
        isFullscreen={false}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("table-visualizer")).toBeInTheDocument(),
    );

    expect(vi.mocked(asyncBufferFromUrl)).toHaveBeenCalledWith(
      expect.objectContaining({ byteLength: 9446073 }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://storage.example.com/unsized.parquet",
      expect.objectContaining({ headers: { Range: "bytes=0-0" } }),
    );
    const methods = fetchSpy.mock.calls.map(([, init]) =>
      (init?.method ?? "GET").toUpperCase(),
    );
    expect(methods).not.toContain("HEAD");
  });

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

  it("loads more rows on demand without re-reading the whole file", async () => {
    mockDataset(SCHEMA, 250);

    renderWithSuspense(
      <ParquetVisualizer
        signedUrl="https://storage.example.com/big.parquet"
        isFullscreen={false}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("table-visualizer")).toHaveAttribute(
        "data-row-count",
        "100",
      ),
    );
    expect(screen.getByTestId("table-visualizer")).toHaveAttribute(
      "data-has-more",
      "true",
    );

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() =>
      expect(screen.getByTestId("table-visualizer")).toHaveAttribute(
        "data-row-count",
        "200",
      ),
    );

    // The second read only pulls the new range, not rows already loaded.
    expect(vi.mocked(parquetReadObjects)).toHaveBeenCalledWith(
      expect.objectContaining({ rowStart: 100, rowEnd: 200 }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Load max" }));
    await waitFor(() =>
      expect(screen.getByTestId("table-visualizer")).toHaveAttribute(
        "data-row-count",
        "250",
      ),
    );
    expect(screen.getByTestId("table-visualizer")).toHaveAttribute(
      "data-has-more",
      "false",
    );
  });

  it("caps rendered rows at the preview limit and offers a full-dataset download", async () => {
    // SCHEMA has two columns, so the cell budget resolves to the row backstop.
    const cap = getPreviewRowLimit(2);
    const total = cap + 2000;
    mockDataset(SCHEMA, total);
    const signedUrl = "https://storage.example.com/huge-rows.parquet";

    renderWithSuspense(
      <ParquetVisualizer signedUrl={signedUrl} isFullscreen={false} />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("table-visualizer")).toHaveAttribute(
        "data-row-count",
        "100",
      ),
    );

    await userEvent.click(screen.getByRole("button", { name: "Load max" }));
    await waitFor(() =>
      expect(screen.getByTestId("table-visualizer")).toHaveAttribute(
        "data-row-count",
        String(cap),
      ),
    );

    const table = screen.getByTestId("table-visualizer");
    expect(table).toHaveAttribute("data-has-more", "true");
    expect(table).toHaveAttribute("data-total-rows", String(total));
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Load max" })).toBeNull();

    expect(lastDownloadFull?.filename).toBe("data.parquet");
    const fullBlob = new Blob(["parquet-bytes"]);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(fullBlob),
    } as unknown as Response);
    const blob = await lastDownloadFull?.getBlob();
    expect(fetchSpy).toHaveBeenCalledWith(signedUrl, undefined);
    expect(blob).toBe(fullBlob);
  });

  it("notifies and keeps the loaded rows when a later read fails", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mockDataset(SCHEMA, 250);
    vi.mocked(parquetReadObjects).mockImplementation(
      async ({ rowStart = 0, rowEnd }) => {
        if (rowStart > 0) throw new Error("Signed URL expired");
        return Array.from({ length: rowEnd ?? 0 }, (_, i) => ({
          name: `row-${i}`,
          score: i * 10,
        }));
      },
    );

    renderWithSuspense(
      <ParquetVisualizer
        signedUrl="https://storage.example.com/expiring.parquet"
        isFullscreen={false}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("table-visualizer")).toHaveAttribute(
        "data-row-count",
        "100",
      ),
    );

    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        "Failed to load more rows. Please try again.",
        "error",
      ),
    );

    // The already-loaded rows survive and the user can retry.
    const table = screen.getByTestId("table-visualizer");
    expect(table).toHaveAttribute("data-row-count", "100");
    expect(table).toHaveAttribute("data-loading", "false");
    expect(
      screen.getByRole("button", { name: "Load more" }),
    ).toBeInTheDocument();

    expect(consoleSpy).toHaveBeenCalled();
  });

  it("caps the initial read at the cell budget for very wide schemas", async () => {
    // 1,000 columns exhausts MAX_PREVIEW_CELLS well before the 100-row preview.
    const columnCount = 1000;
    const cap = getPreviewRowLimit(columnCount);
    expect(cap).toBeLessThan(PARQUET_PREVIEW_ROWS);
    mockWideDataset(columnCount, 500);

    renderWithSuspense(
      <ParquetVisualizer
        signedUrl="https://storage.example.com/wide.parquet"
        isFullscreen={false}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("table-visualizer")).toHaveAttribute(
        "data-row-count",
        String(cap),
      ),
    );

    // The cap is applied to the read itself, not just to what gets rendered.
    expect(vi.mocked(parquetReadObjects)).toHaveBeenCalledWith(
      expect.objectContaining({ rowEnd: cap }),
    );

    const table = screen.getByTestId("table-visualizer");
    expect(table).toHaveAttribute("data-column-count", String(columnCount));
    expect(table).toHaveAttribute("data-has-more", "true");
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Load max" })).toBeNull();
  });

  /**
   * A host that ignores `Range` and returns the whole object: the size probe
   * sees 200 with no `Content-Range`, which is the no-range-support signal.
   */
  const mockFullDownload = (contentLength: string | null) =>
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => contentLength },
      arrayBuffer: async () => new ArrayBuffer(1024),
    } as unknown as Response);

  it("falls back to a full download when range requests are unavailable", async () => {
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
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
    } as unknown as Response);

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
