import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { type ReactElement, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ParquetVisualizer from "./ParquetVisualizer";

vi.mock("hyparquet", () => ({
  parquetReadObjects: vi.fn(),
}));

vi.mock("./TableVisualizer", () => ({
  default: ({
    data,
    isFullscreen,
  }: {
    data: { headers: string[]; rows: string[][] };
    isFullscreen: boolean;
  }) => (
    <div
      data-testid="table-visualizer"
      data-fullscreen={isFullscreen}
      data-headers={data.headers.join(",")}
      data-row-count={data.rows.length}
    />
  ),
}));

const { parquetReadObjects } = await import("hyparquet");

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

beforeEach(() => {
  queryClient.clear();
});

describe("ParquetVisualizer", () => {
  it("fetches, parses parquet, and renders TableVisualizer", async () => {
    const buffer = new ArrayBuffer(8);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(buffer),
    } as Response);

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
});
