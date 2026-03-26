import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { FullscreenElement } from "./FullscreenElement";

describe("FullscreenElement", () => {
  test("renders children in normal mode (not fullscreen)", () => {
    render(
      <FullscreenElement fullscreen={false}>
        <div data-testid="test-content">Test Content</div>
      </FullscreenElement>,
    );

    expect(screen.getByTestId("test-content")).toBeInTheDocument();
  });

  test("renders children in fullscreen mode", () => {
    render(
      <FullscreenElement fullscreen={true}>
        <div data-testid="test-content">Fullscreen Content</div>
      </FullscreenElement>,
    );

    expect(screen.getByTestId("test-content")).toBeInTheDocument();
  });

  test("applies contents class in normal mode", () => {
    render(
      <FullscreenElement fullscreen={false}>
        <div data-testid="test-content">Content</div>
      </FullscreenElement>,
    );

    const container = screen.getByTestId("fullscreen-container");

    expect(container).toHaveClass("contents");
    expect(container).toHaveClass("pointer-events-auto");
    expect(container).not.toHaveClass("fixed");
  });

  test("applies fixed positioning in fullscreen mode", () => {
    render(
      <FullscreenElement fullscreen={true}>
        <div data-testid="test-content">Fullscreen</div>
      </FullscreenElement>,
    );

    const container = screen.getByTestId("fullscreen-container");

    expect(container).toHaveClass("fixed");
    expect(container).toHaveClass("z-2147483647");
    expect(container).toHaveClass("pointer-events-auto");
    expect(container).not.toHaveClass("contents");
  });

  test("switches from normal to fullscreen mode", () => {
    const { rerender } = render(
      <FullscreenElement fullscreen={false}>
        <div data-testid="switching-content">Content</div>
      </FullscreenElement>,
    );

    const container = screen.getByTestId("fullscreen-container");

    expect(container).toHaveClass("contents");

    rerender(
      <FullscreenElement fullscreen={true}>
        <div data-testid="switching-content">Content</div>
      </FullscreenElement>,
    );

    expect(container).toHaveClass("fixed");
    expect(container).toHaveClass("z-2147483647");
  });

  test("switches from fullscreen to normal mode", () => {
    const { rerender } = render(
      <FullscreenElement fullscreen={true}>
        <div data-testid="switching-content">Content</div>
      </FullscreenElement>,
    );

    const container = screen.getByTestId("fullscreen-container");

    expect(container).toHaveClass("fixed");

    rerender(
      <FullscreenElement fullscreen={false}>
        <div data-testid="switching-content">Content</div>
      </FullscreenElement>,
    );

    expect(container).toHaveClass("contents");
    expect(container).not.toHaveClass("fixed");
  });
});
