import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ArtifactNodeResponse } from "@/api/types.gen";

import ArtifactVisualizer from "./ArtifactVisualizer";

const mockTrack = vi.hoisted(() => vi.fn());
vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: mockTrack }),
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "http://localhost:8000" }),
}));

vi.mock("@/services/executionService", () => ({
  getArtifactSignedUrl: vi.fn().mockResolvedValue({
    signed_url: "https://storage.example.com/signed",
  }),
}));

vi.mock("./TextVisualizer", () => ({
  TextVisualizerValue: ({ value }: { value: string }) => (
    <div data-testid="text-visualizer" data-value={value} />
  ),
  TextVisualizerRemote: ({ signedUrl }: { signedUrl: string }) => (
    <div data-testid="text-visualizer" data-signed-url={signedUrl} />
  ),
}));

vi.mock("./ImageVisualizer", () => ({
  default: ({ src, name }: { src: string; name: string }) => (
    <div data-testid="image-visualizer" data-src={src} data-name={name} />
  ),
}));

vi.mock("./CsvVisualizer", () => ({
  CsvVisualizerValue: ({ value }: { value: string }) => (
    <div data-testid="csv-visualizer" data-value={value} />
  ),
  CsvVisualizerRemote: ({ signedUrl }: { signedUrl: string }) => (
    <div data-testid="csv-visualizer" data-signed-url={signedUrl} />
  ),
}));

vi.mock("./JsonVisualizer", () => ({
  JsonVisualizerValue: ({ value, name }: { value: string; name: string }) => (
    <div data-testid="json-visualizer" data-value={value} data-name={name} />
  ),
  JsonVisualizerRemote: ({
    signedUrl,
    name,
  }: {
    signedUrl: string;
    name: string;
  }) => (
    <div
      data-testid="json-visualizer"
      data-signed-url={signedUrl}
      data-name={name}
    />
  ),
}));

vi.mock("./ParquetVisualizer", () => ({
  default: ({ signedUrl }: { signedUrl: string }) => (
    <div data-testid="parquet-visualizer" data-signed-url={signedUrl} />
  ),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderWithQuery = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

const makeArtifact = (
  overrides?: Partial<ArtifactNodeResponse>,
): ArtifactNodeResponse => ({
  id: "artifact-1",
  artifact_data: { total_size: 1024, is_dir: false },
  ...overrides,
});

beforeEach(() => {
  queryClient.clear();
  mockTrack.mockClear();
});

describe("ArtifactVisualizer", () => {
  describe("trigger button", () => {
    it("renders Eye + Preview button when no value is provided", () => {
      renderWithQuery(
        <ArtifactVisualizer
          artifact={makeArtifact()}
          name="output"
          type="text"
        />,
      );

      expect(screen.getByText("Preview")).toBeInTheDocument();
    });

    it("renders Maximize2 button when value is provided", () => {
      renderWithQuery(
        <ArtifactVisualizer
          artifact={makeArtifact()}
          name="output"
          type="text"
          value="inline content"
        />,
      );

      expect(screen.queryByText("Preview")).not.toBeInTheDocument();
      // The maximize button should be present (ghost button without text)
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  it("returns null for non-visualizable types", () => {
    const { container } = renderWithQuery(
      <ArtifactVisualizer
        artifact={makeArtifact()}
        name="output"
        type="Unknown"
      />,
    );

    expect(container.innerHTML).toBe("");
  });

  describe("inline value rendering", () => {
    it("renders TextVisualizerValue for text type", async () => {
      renderWithQuery(
        <ArtifactVisualizer
          artifact={makeArtifact()}
          name="output"
          type="text"
          value="hello"
        />,
      );

      await userEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        const viz = screen.getByTestId("text-visualizer");
        expect(viz).toHaveAttribute("data-value", "hello");
      });
    });

    it("renders CsvVisualizerValue for csv type", async () => {
      renderWithQuery(
        <ArtifactVisualizer
          artifact={makeArtifact()}
          name="data"
          type="CSV"
          value={"a,b\n1,2"}
        />,
      );

      await userEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        const viz = screen.getByTestId("csv-visualizer");
        expect(viz).toHaveAttribute("data-value", "a,b\n1,2");
      });
    });

    it("renders CsvVisualizerValue for tsv type", async () => {
      renderWithQuery(
        <ArtifactVisualizer
          artifact={makeArtifact()}
          name="data"
          type="TSV"
          value={"a\tb\n1\t2"}
        />,
      );

      await userEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        const viz = screen.getByTestId("csv-visualizer");
        expect(viz).toHaveAttribute("data-value", "a\tb\n1\t2");
      });
    });

    it("renders JsonVisualizerValue for jsonobject type", async () => {
      renderWithQuery(
        <ArtifactVisualizer
          artifact={makeArtifact()}
          name="config"
          type="JsonObject"
          value='{"key":"val"}'
        />,
      );

      await userEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        const viz = screen.getByTestId("json-visualizer");
        expect(viz).toHaveAttribute("data-value", '{"key":"val"}');
      });
    });
  });

  describe("signed URL rendering", () => {
    it("renders TextVisualizerRemote with signedUrl for text type", async () => {
      renderWithQuery(
        <ArtifactVisualizer artifact={makeArtifact()} name="log" type="text" />,
      );

      await userEvent.click(screen.getByText("Preview"));

      await waitFor(() => {
        const viz = screen.getByTestId("text-visualizer");
        expect(viz).toHaveAttribute(
          "data-signed-url",
          "https://storage.example.com/signed",
        );
      });
    });

    it("renders ImageVisualizer for image type", async () => {
      renderWithQuery(
        <ArtifactVisualizer
          artifact={makeArtifact()}
          name="photo"
          type="image"
        />,
      );

      await userEvent.click(screen.getByText("Preview"));

      await waitFor(() => {
        expect(screen.getByTestId("image-visualizer")).toBeInTheDocument();
      });
    });

    it("renders ParquetVisualizer for apacheparquet type", async () => {
      renderWithQuery(
        <ArtifactVisualizer
          artifact={makeArtifact()}
          name="data"
          type="Apache Parquet"
        />,
      );

      await userEvent.click(screen.getByText("Preview"));

      await waitFor(() => {
        expect(screen.getByTestId("parquet-visualizer")).toBeInTheDocument();
      });
    });
  });

  describe("analytics", () => {
    it("tracks pipeline_run.task.artifact_preview.impression with artifact_type when preview is opened", async () => {
      renderWithQuery(
        <ArtifactVisualizer
          artifact={makeArtifact()}
          name="output"
          type="CSV"
        />,
      );

      await userEvent.click(screen.getByText("Preview"));

      expect(mockTrack).toHaveBeenCalledWith(
        "pipeline_run.task.artifact_preview.impression",
        { artifact_type: "csv" },
      );
    });

    it("does not track when the dialog is closed", async () => {
      renderWithQuery(
        <ArtifactVisualizer
          artifact={makeArtifact()}
          name="output"
          type="CSV"
        />,
      );

      await userEvent.click(screen.getByText("Preview"));
      mockTrack.mockClear();
      await userEvent.keyboard("{Escape}");

      expect(mockTrack).not.toHaveBeenCalled();
    });
  });

  describe("dialog header", () => {
    it("shows artifact name and type in dialog", async () => {
      renderWithQuery(
        <ArtifactVisualizer
          artifact={makeArtifact()}
          name="my-output"
          type="CSV"
          value="a,b"
        />,
      );

      await userEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByText("my-output")).toBeInTheDocument();
        expect(screen.getByText("CSV")).toBeInTheDocument();
      });
    });

    it("shows artifact URI when available", async () => {
      renderWithQuery(
        <ArtifactVisualizer
          artifact={makeArtifact({
            artifact_data: {
              total_size: 100,
              is_dir: false,
              uri: "gs://bucket/path",
            },
          })}
          name="output"
          type="text"
          value="content"
        />,
      );

      await userEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByText("Copy URI")).toBeInTheDocument();
      });
    });
  });
});
