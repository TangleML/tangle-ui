import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IconTile } from "./icon-tile";

describe("IconTile", () => {
  it("leaves a round tile only its round corners, so its size's corners can't win", () => {
    const { container } = render(
      <IconTile icon="KeyRound" size="sm" shape="round" />,
    );

    expect(container.firstElementChild).toHaveClass("rounded-full");
    expect(container.firstElementChild).not.toHaveClass("rounded-md");
  });

  it("gives a square tile its size's corners", () => {
    const { container } = render(<IconTile icon="KeyRound" size="lg" />);

    expect(container.firstElementChild).toHaveClass("rounded-xl");
  });
});
