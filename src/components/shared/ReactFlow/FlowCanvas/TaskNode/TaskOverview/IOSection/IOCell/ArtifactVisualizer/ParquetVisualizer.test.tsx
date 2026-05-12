import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { type ReactElement, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ParquetVisualizer from "./ParquetVisualizer";
import type { ArtifactColumn } from "./utils";

vi.mock("hyparquet", () => ({
  parquetReadObjects: vi.fn(),
  parquetMetadata: vi.fn(),
}));

vi.mock("./TableVisualizer", () => ({
  default: ({
    data,
    isFullscreen,
  }: {
    data: { columns: ArtifactColumn[]; rows: string[][] };
    isFullscreen: boolean;
  }) => (
    <div
      data-testid="table-visualizer"
      data-fullscreen={isFullscreen}
      data-headers={data.columns.map((c) => c.name).join(",")}
      data-row-count={data.rows.length}
      data-columns={JSON.stringify(data.columns)}
    />
  ),
}));

const { parquetReadObjects, parquetMetadata } = await import("hyparquet");

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

const mockMetadata = (schema: unknown[] = []) =>
  vi.mocked(parquetMetadata).mockReturnValue({
    schema,
  } as unknown as ReturnType<typeof parquetMetadata>);

beforeEach(() => {
  queryClient.clear();
  vi.mocked(parquetMetadata).mockReset();
  vi.mocked(parquetReadObjects).mockReset();
});

describe("ParquetVisualizer", () => {
  it("fetches, parses parquet, and renders TableVisualizer", async () => {
    const buffer = new ArrayBuffer(8);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(buffer),
    } as Response);

    mockMetadata([
      { name: "root" },
      { name: "name", type: "BYTE_ARRAY", repetition_type: "OPTIONAL" },
      { name: "score", type: "INT64", repetition_type: "REQUIRED" },
    ]);
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
    });

    vi.restoreAllMocks();
  });

  it("renders error boundary on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

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

    vi.restoreAllMocks();
  });

  it("shows 'No data' for empty parquet files", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as Response);

    mockMetadata([]);
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

    vi.restoreAllMocks();
  });

  it("passes isFullscreen to TableVisualizer", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as Response);

    mockMetadata([
      { name: "root" },
      { name: "col", type: "BYTE_ARRAY", repetition_type: "OPTIONAL" },
    ]);
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

    vi.restoreAllMocks();
  });

  it("attaches schema-derived type and nullable flags to each column", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    } as Response);

    mockMetadata([
      { name: "root" },
      { name: "id", type: "INT64", repetition_type: "REQUIRED" },
      {
        name: "label",
        type: "BYTE_ARRAY",
        repetition_type: "OPTIONAL",
        logical_type: { type: "STRING" },
      },
    ]);
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

    vi.restoreAllMocks();
  });
});
