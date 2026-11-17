import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { useDismissProjectCard } from "./projectCardContext";
import { ProjectPanelCard } from "./ProjectPanelCard";

vi.mock("./ResourcesWindowContent", () => ({
  ResourcesWindowContent: function Resources() {
    const dismiss = useDismissProjectCard();
    return (
      <button type="button" onClick={dismiss}>
        Open the pipeline already in the canvas
      </button>
    );
  },
}));
vi.mock("./AssetsWindowContent", () => ({
  AssetsWindowContent: () => <div>assets list</div>,
}));
vi.mock("./RunsWindowContent", () => ({
  RunsWindowContent: () => <div>runs list</div>,
}));

/** Like the pipeline canvas: it stops presses before they bubble up. */
function SwallowingCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    const swallow = (event: Event) => event.stopPropagation();
    el?.addEventListener("pointerdown", swallow);
    return () => el?.removeEventListener("pointerdown", swallow);
  }, []);
  return <div ref={ref} data-testid="canvas" />;
}

async function openCard() {
  const user = userEvent.setup();
  render(
    <>
      <ProjectPanelCard />
      <SwallowingCanvas />
      <div role="menu" data-testid="menu-from-card" />
    </>,
  );
  await user.click(screen.getByRole("button", { name: "Project resources" }));
  return user;
}

const isOpen = () => screen.queryByText("runs list") !== null;

describe("ProjectPanelCard", () => {
  it("opens the project's resources, assets and runs", async () => {
    await openCard();

    for (const section of ["Resources", "Assets", "Runs"]) {
      expect(screen.getByRole("region", { name: section })).toBeInTheDocument();
    }
    expect(screen.queryByRole("region", { name: "Project" })).toBeNull();
  });

  it("closes when anything in it is chosen, even what is already open", async () => {
    const user = await openCard();

    await user.click(
      screen.getByRole("button", {
        name: "Open the pipeline already in the canvas",
      }),
    );

    expect(isOpen()).toBe(false);
  });

  it("closes on a press outside it, even where the press is swallowed", async () => {
    await openCard();

    fireEvent.pointerDown(screen.getByTestId("canvas"));

    expect(isOpen()).toBe(false);
  });

  it("stays open while working in a menu it opened", async () => {
    await openCard();

    fireEvent.pointerDown(screen.getByTestId("menu-from-card"));

    expect(isOpen()).toBe(true);
  });

  /** A press inside an artifact's iframe never reaches the page. */
  it("closes when focus leaves the page for a frame", async () => {
    await openCard();

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    expect(isOpen()).toBe(false);
  });
});
