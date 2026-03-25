import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ImageVisualizer from "./ImageVisualizer";

describe("ImageVisualizer", () => {
  it("renders an image with the correct src and alt", () => {
    render(
      <ImageVisualizer src="https://example.com/image.png" name="test-image" />,
    );
    const img = screen.getByRole("img", { name: "test-image" });
    expect(img).toHaveAttribute("src", "https://example.com/image.png");
  });

  it("applies object-contain styling", () => {
    render(
      <ImageVisualizer src="https://example.com/photo.jpg" name="photo" />,
    );
    const img = screen.getByRole("img");
    expect(img).toHaveClass("object-contain");
  });
});
