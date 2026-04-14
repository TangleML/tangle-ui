import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { type ReactElement, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TextVisualizerRemote, TextVisualizerValue } from "./TextVisualizer";

vi.mock("@/components/shared/CodeViewer/CodeEditor", () => ({
  default: ({ value }: { value: string }) => (
    <pre data-testid="code-editor">{value}</pre>
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

describe("TextVisualizerValue", () => {
  it("renders the value in the code editor", () => {
    renderWithQuery(<TextVisualizerValue value="Hello world" />);
    expect(screen.getByTestId("code-editor")).toHaveTextContent("Hello world");
  });

  it("renders the language selector", () => {
    renderWithQuery(<TextVisualizerValue value="Hello world" />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders 'No data' for empty value", () => {
    renderWithQuery(<TextVisualizerValue value="" />);
    expect(screen.getByText("No data")).toBeInTheDocument();
  });

  it("does not fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderWithQuery(<TextVisualizerValue value="inline text" />);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("TextVisualizerRemote", () => {
  it("renders fetched text content", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("Remote content"),
    } as Response);

    renderWithSuspense(
      <TextVisualizerRemote signedUrl="https://storage.example.com/artifact" />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toHaveTextContent(
        "Remote content",
      );
    });

    vi.restoreAllMocks();
  });

  it("renders error boundary on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    renderWithSuspense(
      <TextVisualizerRemote signedUrl="https://storage.example.com/missing" />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("error")).toBeInTheDocument();
      expect(screen.getByText(/Failed to fetch artifact/)).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });

  it("shows 'No data' when fetched text is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(""),
    } as Response);

    renderWithSuspense(
      <TextVisualizerRemote signedUrl="https://storage.example.com/empty" />,
    );

    await waitFor(() => {
      expect(screen.getByText("No data")).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });
});
