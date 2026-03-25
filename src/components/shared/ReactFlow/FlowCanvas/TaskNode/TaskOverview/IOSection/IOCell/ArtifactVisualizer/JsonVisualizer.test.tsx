import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { type ReactElement, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JsonVisualizerRemote, JsonVisualizerValue } from "./JsonVisualizer";

vi.mock("../IOCodeViewer", () => ({
  default: ({ title, value }: { title: string; value: string }) => (
    <div data-testid="io-code-viewer" data-title={title}>
      {value}
    </div>
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

describe("JsonVisualizerValue", () => {
  it("renders the JSON value via IOCodeViewer", () => {
    const json = '{"key": "value"}';
    renderWithQuery(<JsonVisualizerValue value={json} name="output.json" />);

    const viewer = screen.getByTestId("io-code-viewer");
    expect(viewer).toHaveAttribute("data-title", "output.json");
    expect(viewer).toHaveTextContent(json);
  });

  it("does not fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderWithQuery(<JsonVisualizerValue value='{"a":1}' name="test" />);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("JsonVisualizerRemote", () => {
  it("renders fetched JSON content", async () => {
    const json = '{"fetched": true}';
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(json),
    } as Response);

    renderWithSuspense(
      <JsonVisualizerRemote
        signedUrl="https://storage.example.com/data.json"
        name="remote.json"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("io-code-viewer")).toHaveTextContent(json);
    });

    vi.restoreAllMocks();
  });

  it("renders error boundary on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    renderWithSuspense(
      <JsonVisualizerRemote
        signedUrl="https://storage.example.com/broken"
        name="broken.json"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch artifact/)).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });
});
