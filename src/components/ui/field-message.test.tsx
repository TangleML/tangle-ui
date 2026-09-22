import { readFileSync } from "node:fs";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FieldMessage } from "./field-message";

afterEach(cleanup);

const TONES = ["subdued", "info", "warning", "critical", "success"] as const;

const colorTokens = () => {
  const globalCss = readFileSync("src/styles/global.css", "utf8");
  const tokens = new Set<string>();
  for (const [, name] of globalCss.matchAll(/--color-([a-z-]+):/g)) {
    tokens.add(name);
  }
  return tokens;
};

// An svg's className is an SVGAnimatedString, so read the attribute instead.
const classesOf = (element: Element | null) =>
  (element?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

const colorClasses = (classes: string[]) =>
  classes
    .map((className) => className.replace(/^!/, ""))
    .filter((className) => className.startsWith("text-"))
    .filter((className) => !/^text-(xs|sm|base|lg|xl|\dxl)$/.test(className));

describe("FieldMessage", () => {
  it("renders the message without an icon by default", () => {
    const { container } = render(<FieldMessage>Project: acme</FieldMessage>);

    expect(screen.getByText("Project: acme")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders the named icon alongside the message", () => {
    const { container } = render(
      <FieldMessage tone="warning" icon="TriangleAlert">
        No longer available
      </FieldMessage>,
    );

    expect(screen.getByText("No longer available")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it.each(TONES)("tone=%s tints the icon with a defined token", (tone) => {
    const tokens = colorTokens();
    const { container } = render(
      <FieldMessage tone={tone} icon="TriangleAlert">
        message
      </FieldMessage>,
    );

    const tinted = colorClasses(classesOf(container.querySelector("svg")));

    expect(tinted.length).toBeGreaterThan(0);
    for (const className of tinted) {
      expect(tokens).toContain(className.slice("text-".length));
    }
  });

  it.each(TONES)(
    "tone=%s leaves the message itself in the muted foreground",
    (tone) => {
      // Several tone tokens are too light to set text in on a light background,
      // so the tone must never reach the words.
      render(
        <FieldMessage tone={tone} icon="TriangleAlert">
          message
        </FieldMessage>,
      );

      expect(colorClasses(classesOf(screen.getByText("message")))).toEqual([
        "text-muted-foreground",
      ]);
    },
  );

  it("truncates only when asked", () => {
    render(<FieldMessage truncate>Project: acme</FieldMessage>);
    expect(classesOf(screen.getByText("Project: acme"))).toContain("truncate");

    cleanup();

    render(
      <FieldMessage>a whole sentence explaining the warning</FieldMessage>,
    );
    expect(
      classesOf(screen.getByText("a whole sentence explaining the warning")),
    ).not.toContain("truncate");
  });
});
