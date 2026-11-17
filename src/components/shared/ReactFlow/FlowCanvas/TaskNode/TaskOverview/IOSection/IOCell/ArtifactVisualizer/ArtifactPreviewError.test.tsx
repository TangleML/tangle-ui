import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArtifactFetchError } from "@/services/executionService";

import { ArtifactPreviewErrorFallback } from "./ArtifactPreviewError";
import { ParquetUnsupportedCodecError } from "./parquetUtils";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ArtifactPreviewErrorFallback", () => {
  it("names the unsupported compression codec", () => {
    render(
      <ArtifactPreviewErrorFallback
        error={new ParquetUnsupportedCodecError("ZSTD")}
      />,
    );

    expect(screen.getByText("Can't preview this file")).toBeInTheDocument();
    expect(
      screen.getByText(/Unsupported compression codec: ZSTD\./),
    ).toBeInTheDocument();
  });

  it("shows the reason for an unexpected error as secondary detail", () => {
    render(
      <ArtifactPreviewErrorFallback
        error={new Error("parquet unsupported encoding: BIT_PACKED")}
      />,
    );

    expect(screen.getByText("Failed to load artifact")).toBeInTheDocument();
    expect(
      screen.getByText("An unexpected error occurred."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("parquet unsupported encoding: BIT_PACKED"),
    ).toBeInTheDocument();
  });

  it("shows the HTTP status for a failed fetch", () => {
    render(
      <ArtifactPreviewErrorFallback
        error={
          new ArtifactFetchError(
            500,
            "Server Error",
            "Failed to fetch artifact.",
          )
        }
      />,
    );

    expect(
      screen.getByText("An unexpected error occurred (500 Server Error)."),
    ).toBeInTheDocument();
  });

  it("explains an oversized artifact without a retention hint", () => {
    vi.stubEnv("VITE_ARTIFACT_RETENTION_DAYS", "30");

    render(
      <ArtifactPreviewErrorFallback
        error={
          new ArtifactFetchError(
            413,
            "Payload Too Large",
            "This parquet file is too large to preview.",
          )
        }
      />,
    );

    expect(screen.getByText("Too large to preview")).toBeInTheDocument();
    expect(screen.queryByText(/may have expired/)).not.toBeInTheDocument();
  });

  it("adds the retention hint when a fetch fails and retention is configured", () => {
    vi.stubEnv("VITE_ARTIFACT_RETENTION_DAYS", "30");

    render(
      <ArtifactPreviewErrorFallback
        error={new ArtifactFetchError(404, "Not Found", "Not found.")}
      />,
    );

    expect(screen.getByText("Artifact unavailable")).toBeInTheDocument();
    expect(screen.getByText(/available for up to 30 days/)).toBeInTheDocument();
  });
});
