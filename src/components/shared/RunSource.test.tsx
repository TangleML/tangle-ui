import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { getRunSourceMessage, hasRunSource, RunSourceIcon } from "./RunSource";

const iconNameOf = (source?: string | null) => {
  const { container } = render(
    <TooltipProvider>
      <RunSourceIcon source={source} />
    </TooltipProvider>,
  );
  return container.querySelector("svg")?.getAttribute("class") ?? "";
};

describe("getRunSourceMessage", () => {
  it("names each submitter this app knows about", () => {
    expect(getRunSourceMessage("web-app")).toBe(
      "Submitted via the Tangle web app",
    );
    expect(getRunSourceMessage("tangent-ui")).toBe(
      "Submitted by an agent in the Tangle web app",
    );
    expect(getRunSourceMessage("tangle-cli")).toBe(
      "Submitted via the Tangle CLI",
    );
    expect(getRunSourceMessage("tangent")).toBe("Submitted by a Tangent agent");
  });

  /** Anything may submit a run, so the map is a reader's vocabulary. */
  it("falls back for a submitter it has never heard of", () => {
    expect(getRunSourceMessage("some-future-tool")).toBe(
      "Submitted by other means",
    );
  });

  it("tells an unrecorded source apart from an unrecognised one", () => {
    expect(getRunSourceMessage(null)).toBe("Source unknown");
    expect(getRunSourceMessage(undefined)).toBe("Source unknown");
    expect(getRunSourceMessage("")).toBe("Source unknown");
  });
});

describe("hasRunSource", () => {
  it("is false only when the run recorded nothing", () => {
    expect(hasRunSource("web-app")).toBe(true);
    expect(hasRunSource("some-future-tool")).toBe(true);
    expect(hasRunSource("")).toBe(false);
    expect(hasRunSource(null)).toBe(false);
    expect(hasRunSource(undefined)).toBe(false);
  });
});

describe("RunSourceIcon", () => {
  it("gives the CLI and the web app different icons", () => {
    expect(iconNameOf("tangle-cli")).toContain("lucide-terminal");
    expect(iconNameOf("web-app")).toContain("lucide-app-window");
  });

  it("tells the two agent sources apart", () => {
    expect(iconNameOf("tangent")).toContain("lucide-sparkles");
    expect(iconNameOf("tangent-ui")).toContain("lucide-bot");
  });

  it("marks a run that recorded no source", () => {
    expect(iconNameOf(null)).toContain("lucide-circle-question-mark");
  });

  it("falls back for a submitter it has never heard of", () => {
    expect(iconNameOf("some-future-tool")).toContain("lucide-earth");
  });
});
