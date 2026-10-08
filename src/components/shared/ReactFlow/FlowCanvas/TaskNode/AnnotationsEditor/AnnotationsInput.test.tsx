import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { AnnotationConfig } from "@/types/annotations";

import { AnnotationsInput } from "./AnnotationsInput";

const NOTE =
  "Tasks here run under your own account. Create one at https://example.test/setup first.";

const config = (note?: string, deprecated?: boolean): AnnotationConfig => ({
  annotation: "cloud-pipelines.net/orchestration/cloud_provider",
  label: "Cluster",
  options: [
    { value: "acme", name: "Acme", note, deprecated },
    { value: "gke", name: "GKE" },
  ],
});

const renderInput = (value: string, annotationConfig: AnnotationConfig) =>
  render(
    <AnnotationsInput
      value={value}
      config={annotationConfig}
      annotations={{}}
    />,
  );

describe("AnnotationsInput target note", () => {
  test("shows the selected target's note, with its URL clickable", () => {
    renderInput("acme", config(NOTE));

    expect(screen.getByText(/run under your own account/)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://example.test/setup",
    );
  });

  test("shows nothing for a target with no note", () => {
    renderInput("gke", config(NOTE));

    expect(
      screen.queryByText(/run under your own account/),
    ).not.toBeInTheDocument();
  });

  test("gives way to the deprecation message rather than stacking under it", () => {
    renderInput("acme", config(NOTE, true));

    expect(screen.getByText("No longer available")).toBeInTheDocument();
    expect(
      screen.queryByText(/run under your own account/),
    ).not.toBeInTheDocument();
  });
});
