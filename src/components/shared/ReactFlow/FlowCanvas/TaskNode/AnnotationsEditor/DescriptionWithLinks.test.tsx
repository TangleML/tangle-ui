import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DescriptionWithLinks } from "./DescriptionWithLinks";

const hrefs = () =>
  screen.getAllByRole("link").map((link) => link.getAttribute("href"));

describe("DescriptionWithLinks", () => {
  it.each([
    ["Sign up at https://example.test/setup.", ["https://example.test/setup"]],
    [
      "See https://a.test/x, then https://b.test/y!",
      ["https://a.test/x", "https://b.test/y"],
    ],
    [
      "Docs (https://example.test/docs) are online",
      ["https://example.test/docs"],
    ],
    ['Open "https://example.test/q" now', ["https://example.test/q"]],
  ])(
    "leaves trailing prose punctuation out of the link in %j",
    (text, expected) => {
      render(<DescriptionWithLinks text={text} />);

      expect(hrefs()).toEqual(expected);
    },
  );

  it("keeps punctuation that is part of the address", () => {
    render(
      <DescriptionWithLinks text="Go to https://example.test/a.b/c?q=1&r=2#top" />,
    );

    expect(hrefs()).toEqual(["https://example.test/a.b/c?q=1&r=2#top"]);
  });

  it("still renders the trailing punctuation as text after the link", () => {
    const { container } = render(
      <DescriptionWithLinks text="Sign up at https://example.test/setup." />,
    );

    expect(container).toHaveTextContent(
      "Sign up at https://example.test/setup.",
    );
  });
});
