import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { type ReactElement, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CsvVisualizerRemote, CsvVisualizerValue } from "./CsvVisualizer";

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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithQuery = (ui: ReactElement) =>
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

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

describe("CsvVisualizerValue", () => {
  it("parses CSV and renders TableVisualizer", () => {
    renderWithQuery(
      <CsvVisualizerValue
        value={"Name,Age\nAlice,30\nBob,25"}
        isFullscreen={false}
      />,
    );

    const table = screen.getByTestId("table-visualizer");
    expect(table).toHaveAttribute("data-headers", "Name,Age");
    expect(table).toHaveAttribute("data-row-count", "2");
  });

  it("parses TSV with tab delimiter", () => {
    renderWithQuery(
      <CsvVisualizerValue
        value={"Name\tAge\nAlice\t30"}
        isFullscreen={false}
      />,
    );

    const table = screen.getByTestId("table-visualizer");
    expect(table).toHaveAttribute("data-headers", "Name,Age");
  });

  it("shows 'No data' for empty CSV", () => {
    renderWithQuery(<CsvVisualizerValue value="" isFullscreen={false} />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("does not fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderWithQuery(
      <CsvVisualizerValue value="a,b\n1,2" isFullscreen={false} />,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("CsvVisualizerRemote", () => {
  it("fetches and renders CSV data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("X,Y\n1,2\n3,4"),
    } as Response);

    renderWithSuspense(
      <CsvVisualizerRemote
        signedUrl="https://storage.example.com/data.csv"
        isFullscreen={false}
      />,
    );

    await waitFor(() => {
      const table = screen.getByTestId("table-visualizer");
      expect(table).toHaveAttribute("data-headers", "X,Y");
      expect(table).toHaveAttribute("data-row-count", "2");
    });

    vi.restoreAllMocks();
  });

  it("renders error boundary on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    renderWithSuspense(
      <CsvVisualizerRemote
        signedUrl="https://storage.example.com/forbidden.csv"
        isFullscreen={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch artifact/)).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });

  it("passes isFullscreen to TableVisualizer", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("A,B\n1,2"),
    } as Response);

    renderWithSuspense(
      <CsvVisualizerRemote
        signedUrl="https://storage.example.com/data.csv"
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
