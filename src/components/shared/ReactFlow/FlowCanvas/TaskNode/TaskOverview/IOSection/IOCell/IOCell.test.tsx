import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ArtifactNodeResponse } from "@/api/types.gen";

import IOCell from "./IOCell";

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "http://localhost:8000" }),
}));

vi.mock("./ArtifactVisualizer/ArtifactVisualizer", () => ({
  default: ({
    name,
    type,
    value,
  }: {
    name: string;
    type: string;
    value?: string;
  }) => (
    <div
      data-testid="artifact-visualizer"
      data-name={name}
      data-type={type}
      data-value={value}
    />
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
  artifact_data: { total_size: 0, is_dir: false },
  ...overrides,
});

describe("IOCell", () => {
  it("renders the artifact name", () => {
    renderWithQuery(<IOCell name="my_input" artifact={null} />);
    expect(screen.getByText("my_input")).toBeInTheDocument();
  });

  it("shows the explicit type when provided", () => {
    renderWithQuery(
      <IOCell name="input" type="CSV" artifact={makeArtifact()} />,
    );
    expect(screen.getByText("CSV")).toBeInTheDocument();
  });

  it("falls back to type_name from artifact", () => {
    renderWithQuery(
      <IOCell
        name="input"
        artifact={makeArtifact({ type_name: "JsonObject" })}
      />,
    );
    expect(screen.getByText("JsonObject")).toBeInTheDocument();
  });

  it("shows 'Directory' when artifact is a directory", () => {
    renderWithQuery(
      <IOCell
        name="input"
        artifact={makeArtifact({
          artifact_data: { total_size: 0, is_dir: true },
        })}
      />,
    );
    expect(screen.getByText("Directory")).toBeInTheDocument();
  });

  it("shows 'Any' as default type", () => {
    renderWithQuery(<IOCell name="input" artifact={makeArtifact()} />);
    expect(screen.getByText("Any")).toBeInTheDocument();
  });

  it("displays formatted file size", () => {
    renderWithQuery(
      <IOCell
        name="input"
        type="text"
        artifact={makeArtifact({
          artifact_data: { total_size: 2048, is_dir: false },
        })}
      />,
    );
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });

  it("renders ArtifactVisualizer with value for inline values", () => {
    renderWithQuery(
      <IOCell
        name="output"
        type="text"
        artifact={makeArtifact({
          artifact_data: {
            total_size: 100,
            is_dir: false,
            value: "hello world",
          },
        })}
      />,
    );

    const viz = screen.getByTestId("artifact-visualizer");
    expect(viz).toHaveAttribute("data-value", "hello world");
    expect(viz).toHaveAttribute("data-type", "text");
  });

  it("renders ArtifactVisualizer without value for remote artifacts", () => {
    renderWithQuery(
      <IOCell
        name="output"
        type="CSV"
        artifact={makeArtifact({
          artifact_data: {
            total_size: 5000,
            is_dir: false,
            uri: "gs://bucket/data.csv",
          },
        })}
      />,
    );

    const viz = screen.getByTestId("artifact-visualizer");
    expect(viz).not.toHaveAttribute("data-value");
    expect(viz).toHaveAttribute("data-type", "CSV");
  });

  it("renders inline value text with line-clamp", () => {
    renderWithQuery(
      <IOCell
        name="output"
        type="text"
        artifact={makeArtifact({
          artifact_data: {
            total_size: 100,
            is_dir: false,
            value: "some inline value",
          },
        })}
      />,
    );

    expect(screen.getByText("some inline value")).toBeInTheDocument();
  });

  it("does not render inline value for whitespace-only strings", () => {
    renderWithQuery(
      <IOCell
        name="output"
        type="text"
        artifact={makeArtifact({
          artifact_data: {
            total_size: 0,
            is_dir: false,
            value: "   ",
          },
        })}
      />,
    );

    expect(screen.queryByTestId("artifact-visualizer")).not.toBeInTheDocument();
  });

  it("renders artifact URI when available", () => {
    renderWithQuery(
      <IOCell
        name="output"
        artifact={makeArtifact({
          artifact_data: {
            total_size: 0,
            is_dir: false,
            uri: "gs://my-bucket/path/to/artifact",
          },
        })}
      />,
    );

    expect(screen.getByText("Copy URI")).toBeInTheDocument();
  });

  it("does not render ArtifactVisualizer when artifact is null", () => {
    renderWithQuery(<IOCell name="input" type="CSV" artifact={null} />);
    expect(screen.queryByTestId("artifact-visualizer")).not.toBeInTheDocument();
  });

  it("defaults type to 'text' for inline values without explicit type", () => {
    renderWithQuery(
      <IOCell
        name="output"
        artifact={makeArtifact({
          artifact_data: {
            total_size: 10,
            is_dir: false,
            value: "some value",
          },
        })}
      />,
    );

    const viz = screen.getByTestId("artifact-visualizer");
    expect(viz).toHaveAttribute("data-type", "text");
  });
});
