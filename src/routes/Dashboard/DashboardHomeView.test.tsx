import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardHomeView } from "./DashboardHomeView";
import {
  DashboardSectionFrame,
  type DashboardWidgetProps,
} from "./DashboardSectionFrame";
import {
  DEFAULT_SECTIONS,
  readDashboardLayout,
  saveDashboardLayout,
} from "./dashboardSections";

const { emptyTypes } = vi.hoisted(() => ({ emptyTypes: new Set<string>() }));

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

vi.mock("@/components/shared/Notices/NoticeBanners", () => ({
  NoticeBanners: () => null,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("./DashboardWidget", () => ({
  DashboardWidget: (props: DashboardWidgetProps) => (
    <DashboardSectionFrame
      {...props}
      empty={emptyTypes.has(props.section.type ?? "")}
    >
      <a href="/runs">Example run</a>
    </DashboardSectionFrame>
  ),
}));

beforeEach(() => {
  localStorage.clear();
  emptyTypes.clear();
  emptyTypes.add("favorites");
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn();
  saveDashboardLayout([
    { id: "runs", type: "runs", width: 3 },
    { id: "favorites", type: "favorites", width: 1 },
  ]);
});

describe("dashboard customization", () => {
  it("describes the pencil action with a tooltip on hover", async () => {
    const user = userEvent.setup();
    render(<DashboardHomeView />);
    const edit = screen.getByRole("button", { name: "Edit dashboard layout" });
    expect(edit.textContent).toBe("");
    await user.hover(edit);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Edit dashboard layout",
    );
  });

  it.each([
    {
      empty: ["favorites"],
      visible: ["Recently Viewed", "Recently Used Components"],
    },
    { empty: ["favorites", "recent-components"], visible: ["Recently Viewed"] },
  ])(
    "keeps populated sections in their configured row after saving: $empty",
    async ({ empty, visible }) => {
      empty.forEach((type) => emptyTypes.add(type));
      saveDashboardLayout(DEFAULT_SECTIONS);
      const user = userEvent.setup();
      render(<DashboardHomeView />);
      await user.click(
        screen.getByRole("button", { name: "Edit dashboard layout" }),
      );
      await user.click(screen.getByRole("button", { name: "Save layout" }));

      const topRow = screen
        .getByRole("region", { name: "Recently Viewed" })
        .closest("[data-dashboard-row]")!;
      expect(
        within(topRow as HTMLElement)
          .getAllByRole("region")
          .map((section) => section.getAttribute("aria-label")),
      ).toEqual(visible);
      const projects = screen.getByRole("region", { name: "My Projects" });
      const secondRow = projects.closest("[data-dashboard-row]")!;
      expect(secondRow).not.toBe(topRow);
      expect(
        within(secondRow as HTMLElement)
          .getAllByRole("region")
          .map((section) => section.getAttribute("aria-label")),
      ).toEqual(["My Projects", "My Pipelines"]);
      expect(
        screen
          .getByRole("region", { name: "My Runs" })
          .closest("[data-dashboard-row]"),
      ).not.toBe(secondRow);
      expect(readDashboardLayout()).toEqual(DEFAULT_SECTIONS);
    },
  );

  it("hides empty sections in view mode and restores them for editing", async () => {
    const user = userEvent.setup();
    render(<DashboardHomeView />);
    expect(screen.queryByRole("region", { name: "Favorites" })).toBeNull();
    expect(screen.getByRole("link", { name: "Example run" })).toHaveAttribute(
      "href",
      "/runs",
    );
    await user.click(
      screen.getByRole("button", { name: "Edit dashboard layout" }),
    );
    expect(
      screen.getByRole("region", { name: "Favorites" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add section at top" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add section at bottom" }),
    ).toBeInTheDocument();
  });

  it("keeps resizing and removal in a draft until Save, and Cancel discards it", async () => {
    const user = userEvent.setup();
    render(<DashboardHomeView />);
    await user.click(
      screen.getByRole("button", { name: "Edit dashboard layout" }),
    );
    await user.click(
      within(screen.getByRole("region", { name: "My Runs" })).getByRole(
        "button",
        { name: "⅓" },
      ),
    );
    await user.click(
      screen.getByRole("button", { name: "Remove Favorites section" }),
    );
    expect(readDashboardLayout()[0].width).toBe(3);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("region", { name: "My Runs" })).toHaveAttribute(
      "data-width",
      "3",
    );
    await user.click(
      screen.getByRole("button", { name: "Edit dashboard layout" }),
    );
    expect(
      screen.getByRole("region", { name: "Favorites" }),
    ).toBeInTheDocument();
    await user.click(
      within(screen.getByRole("region", { name: "My Runs" })).getByRole(
        "button",
        { name: "⅔" },
      ),
    );
    await user.click(screen.getByRole("button", { name: "Save layout" }));
    expect(readDashboardLayout()[0].width).toBe(2);
  });

  it("builds a section from a blank dashboard and persists it across mounts", async () => {
    saveDashboardLayout([]);
    const user = userEvent.setup();
    const view = render(<DashboardHomeView />);
    await user.click(
      screen.getByRole("button", { name: "Edit dashboard layout" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add section at bottom" }),
    );
    await user.click(screen.getByRole("combobox", { name: "Section content" }));
    expect(
      screen.queryByRole("option", { name: "Components" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Recently Used Components" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "My Runs" }));
    await user.click(screen.getByRole("button", { name: "Save layout" }));
    view.unmount();
    render(<DashboardHomeView />);
    expect(screen.getByRole("region", { name: "My Runs" })).toBeInTheDocument();
    expect(readDashboardLayout()).toEqual([
      expect.objectContaining({ type: "runs", width: 3 }),
    ]);
  });

  it("adds sections at the top and bottom and saves them in that order", async () => {
    const user = userEvent.setup();
    render(<DashboardHomeView />);
    await user.click(
      screen.getByRole("button", { name: "Edit dashboard layout" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Add section at top" }),
    );
    await user.click(
      within(screen.getByRole("region", { name: "New section" })).getByRole(
        "combobox",
        { name: "Section content" },
      ),
    );
    await user.click(screen.getByRole("option", { name: "My Pipelines" }));
    await user.click(
      screen.getByRole("button", { name: "Add section at bottom" }),
    );
    await user.click(
      within(screen.getByRole("region", { name: "New section" })).getByRole(
        "combobox",
        { name: "Section content" },
      ),
    );
    await user.click(screen.getByRole("option", { name: "Recently Used" }));
    expect(
      screen
        .getAllByRole("region")
        .map((section) => section.getAttribute("aria-label")),
    ).toEqual(["My Pipelines", "My Runs", "Favorites", "Recently Used"]);
    expect(readDashboardLayout().map((section) => section.type)).toEqual([
      "runs",
      "favorites",
    ]);
    await user.click(screen.getByRole("button", { name: "Save layout" }));
    expect(readDashboardLayout().map((section) => section.type)).toEqual([
      "pipelines",
      "runs",
      "favorites",
      "used",
    ]);
    expect(
      screen.queryByRole("button", { name: "Add section at top" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add section at bottom" }),
    ).not.toBeInTheDocument();
  });

  it("swaps adjacent sections with visible arrows and Cancel restores their order", async () => {
    const layout = [
      { id: "recent", type: "recent", width: 1 },
      { id: "favorites", type: "favorites", width: 1 },
      { id: "used", type: "used", width: 1 },
    ] as const;
    saveDashboardLayout([...layout]);
    const user = userEvent.setup();
    render(<DashboardHomeView />);
    await user.click(
      screen.getByRole("button", { name: "Edit dashboard layout" }),
    );
    expect(
      screen.getByRole("button", { name: "Move Recently Viewed left" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move Recently Used right" }),
    ).toBeDisabled();

    screen.getByRole("button", { name: "Move Recently Used left" }).focus();
    await user.keyboard("{Enter}");
    expect(
      screen
        .getAllByRole("region")
        .map((section) => section.getAttribute("data-dashboard-section")),
    ).toEqual(["recent", "used", "favorites"]);
    expect(
      screen.getByRole("button", { name: "Move Recently Used left" }),
    ).toHaveFocus();
    await user.click(
      screen.getByRole("button", { name: "Move Recently Used left" }),
    );
    expect(
      screen
        .getAllByRole("region")
        .map((section) => section.getAttribute("data-dashboard-section")),
    ).toEqual(["used", "recent", "favorites"]);
    expect(
      screen.getByRole("button", { name: "Move Recently Used left" }),
    ).toBeDisabled();
    await user.click(
      screen.getByRole("button", { name: "Move Recently Used right" }),
    );
    expect(
      screen
        .getAllByRole("region")
        .map((section) => section.getAttribute("data-dashboard-section")),
    ).toEqual(["recent", "used", "favorites"]);
    expect(
      screen.getByRole("button", { name: "Move Recently Used right" }),
    ).toHaveFocus();
    expect(readDashboardLayout()).toEqual(layout);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(
      screen.getByRole("button", { name: "Edit dashboard layout" }),
    );
    expect(
      screen
        .getAllByRole("region")
        .map((section) => section.getAttribute("data-dashboard-section")),
    ).toEqual(["recent", "favorites", "used"]);
  });

  it("supports keyboard ordering and direct removal, including saving a blank layout", async () => {
    const user = userEvent.setup();
    render(<DashboardHomeView />);
    await user.click(
      screen.getByRole("button", { name: "Edit dashboard layout" }),
    );
    screen.getByRole("button", { name: "Move Favorites left" }).focus();
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Save layout" }));
    expect(readDashboardLayout().map(({ id }) => id)).toEqual([
      "favorites",
      "runs",
    ]);
    await user.click(
      screen.getByRole("button", { name: "Edit dashboard layout" }),
    );
    for (const title of ["Favorites", "My Runs"]) {
      await user.click(
        screen.getByRole("button", { name: `Remove ${title} section` }),
      );
    }
    await user.click(screen.getByRole("button", { name: "Save layout" }));
    expect(readDashboardLayout()).toEqual([]);
  });
});
