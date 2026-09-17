import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import type { ProjectColor } from "./projectColors";
import { useProjectColors } from "./useProjectColors";

function Probe({ projectId }: { projectId: string }) {
  const { getColor, setColor } = useProjectColors();

  return (
    <>
      <span data-testid="color">{getColor(projectId) ?? "none"}</span>
      <button onClick={() => setColor(projectId, "violet")}>violet</button>
      <button onClick={() => setColor(projectId, undefined)}>clear</button>
    </>
  );
}

const shown = () => screen.getByTestId("color").textContent;

describe("useProjectColors", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("has no colour for a project nobody has coloured", () => {
    render(<Probe projectId="project-1" />);

    expect(shown()).toBe("none");
  });

  it("remembers a colour once it is set", async () => {
    render(<Probe projectId="project-1" />);

    await act(async () => {
      screen.getByRole("button", { name: "violet" }).click();
    });

    expect(shown()).toBe("violet");
  });

  it("forgets a colour when it is cleared", async () => {
    render(<Probe projectId="project-1" />);

    await act(async () => {
      screen.getByRole("button", { name: "violet" }).click();
    });
    await act(async () => {
      screen.getByRole("button", { name: "clear" }).click();
    });

    expect(shown()).toBe("none");
  });

  it("keeps each project's colour to itself", async () => {
    window.localStorage.setItem(
      "projectColors",
      JSON.stringify({ "project-2": "rose" satisfies ProjectColor }),
    );

    render(<Probe projectId="project-1" />);

    expect(shown()).toBe("none");
  });

  it("reads a colour a previous session stored", () => {
    window.localStorage.setItem(
      "projectColors",
      JSON.stringify({ "project-1": "emerald" }),
    );

    render(<Probe projectId="project-1" />);

    expect(shown()).toBe("emerald");
  });

  it("ignores a stored value that is not one of the palette colours", () => {
    window.localStorage.setItem(
      "projectColors",
      JSON.stringify({ "project-1": "hotpink" }),
    );

    render(<Probe projectId="project-1" />);

    expect(shown()).toBe("none");
  });

  it("survives storage holding something that is not a colour map", () => {
    window.localStorage.setItem("projectColors", "not json at all");

    render(<Probe projectId="project-1" />);

    expect(shown()).toBe("none");
  });
});
