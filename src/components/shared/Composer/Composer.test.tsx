import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BlockType, type ComposerSchema } from "@/types/composerSchema";

import { Composer } from "./Composer";

describe("Composer", () => {
  it("renders nothing for empty schema", () => {
    const { container } = render(
      <Composer schema={{ metadata: {}, sections: [] }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders section title and text block", () => {
    const schema: ComposerSchema = {
      metadata: {},
      sections: [
        {
          id: "s1",
          title: "Test Section",
          blocks: [
            {
              id: "b1",
              blockType: BlockType.TextBlock,
              properties: { text: "Hello from composer" },
            },
          ],
        },
      ],
    };

    render(<Composer schema={schema} />);
    expect(screen.getByText("Test Section")).toBeInTheDocument();
    expect(screen.getByText("Hello from composer")).toBeInTheDocument();
  });

  it("renders multiple sections", () => {
    const schema: ComposerSchema = {
      metadata: {},
      sections: [
        {
          id: "s1",
          title: "Section One",
          blocks: [
            {
              id: "b1",
              blockType: BlockType.TextBlock,
              properties: { text: "Block one" },
            },
          ],
        },
        {
          id: "s2",
          title: "Section Two",
          blocks: [
            {
              id: "b2",
              blockType: BlockType.TextBlock,
              properties: { text: "Block two" },
            },
          ],
        },
      ],
    };

    render(<Composer schema={schema} />);
    expect(screen.getByText("Section One")).toBeInTheDocument();
    expect(screen.getByText("Section Two")).toBeInTheDocument();
    expect(screen.getByText("Block one")).toBeInTheDocument();
    expect(screen.getByText("Block two")).toBeInTheDocument();
  });

  it("skips block when isVisible is false", () => {
    const schema: ComposerSchema = {
      metadata: {},
      sections: [
        {
          id: "s1",
          title: "Section",
          blocks: [
            {
              id: "hidden",
              blockType: BlockType.TextBlock,
              properties: {
                text: "Should be hidden",
                isVisible: false,
              },
            },
            {
              id: "visible",
              blockType: BlockType.TextBlock,
              properties: { text: "Should be visible" },
            },
          ],
        },
      ],
    };

    render(<Composer schema={schema} />);
    expect(screen.queryByText("Should be hidden")).not.toBeInTheDocument();
    expect(screen.getByText("Should be visible")).toBeInTheDocument();
  });

  it("warns for unknown block type and renders nothing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const schema: ComposerSchema = {
      metadata: {},
      sections: [
        {
          id: "s1",
          title: "Section",
          blocks: [
            {
              id: "unknown",
              blockType: "UnknownBlock" as BlockType,
              properties: { text: "Should not render" },
            } as ComposerSchema["sections"][0]["blocks"][0],
          ],
        },
      ],
    };

    render(<Composer schema={schema} />);
    expect(screen.queryByText("Should not render")).not.toBeInTheDocument();
    expect(warnSpy).toHaveBeenCalledWith('Unknown block type: "UnknownBlock"');

    warnSpy.mockRestore();
  });

  it("renders LinkBlock with URL as link text", () => {
    const schema: ComposerSchema = {
      metadata: {},
      sections: [
        {
          id: "s1",
          title: "Links",
          blocks: [
            {
              id: "link1",
              blockType: BlockType.LinkBlock,
              properties: {
                urlTemplate: "https://example.com/query",
              },
            },
          ],
        },
      ],
    };

    render(<Composer schema={schema} />);
    expect(screen.getByText("Links")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/query")).toBeInTheDocument();
  });
});
