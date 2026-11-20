import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import type { TroubleshootingGuide } from "@/api/types.gen";

import { TroubleshootingGuideSection } from "./TroubleshootingGuideSection";

const guide: TroubleshootingGuide = {
  title: "Move this pipeline",
  severity: "warning",
  body_markdown: "This task was **blocked**.\n\n1. Update the pipeline.",
  actions: [
    { label: "Read the guide", url: "https://example.test/guide" },
    { label: "Run script", url: "javascript:alert(1)" },
  ],
};

describe("TroubleshootingGuideSection", () => {
  test("shows the title and the markdown body", () => {
    render(<TroubleshootingGuideSection guide={guide} />);

    expect(screen.getByText("Move this pipeline")).toBeInTheDocument();
    expect(screen.getByText("blocked").tagName).toBe("STRONG");
    expect(screen.getByText("Update the pipeline.")).toBeInTheDocument();
  });

  test("renders http actions as links that open in a new tab", () => {
    render(<TroubleshootingGuideSection guide={guide} />);

    const link = screen.getByRole("link", { name: /Read the guide/ });
    expect(link).toHaveAttribute("href", "https://example.test/guide");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("drops actions whose URL is not http", () => {
    render(<TroubleshootingGuideSection guide={guide} />);

    expect(screen.queryByText("Run script")).not.toBeInTheDocument();
  });

  test("renders without actions", () => {
    render(
      <TroubleshootingGuideSection guide={{ ...guide, actions: undefined }} />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
