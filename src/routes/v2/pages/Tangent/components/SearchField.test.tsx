import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CollapsedDockWindowMini } from "@/routes/v2/shared/windows/CollapsedDockWindowMini";
import { DockPopover } from "@/routes/v2/shared/windows/DockPopover";
import { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

import { SearchField } from "./SearchField";

const stores = vi.hoisted(() => ({
  windows: undefined as WindowStoreImpl | undefined,
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ windows: stores.windows }),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

function Search() {
  const [query, setQuery] = useState("");
  return (
    <SearchField
      value={query}
      onChange={setQuery}
      label="Search projects"
      trackingPrefix="test"
    />
  );
}

const searchBox = () =>
  screen.queryByRole("searchbox", { name: "Search projects" });

async function typeThenEscape(user: ReturnType<typeof userEvent.setup>) {
  const box = searchBox();
  if (!box) throw new Error("The search box isn't on screen");
  await user.type(box, "forecast{Escape}");
}

/** Radix closes a popover on Escape before the search box has seen the key. */
describe("SearchField in a popover", () => {
  beforeEach(() => {
    stores.windows = new WindowStoreImpl();
  });

  it("clears on Escape and leaves the dock popover open, which the next Escape closes", async () => {
    const user = userEvent.setup();
    stores.windows?.openWindow(<Search />, {
      id: "projects",
      title: "Projects",
      defaultDockState: "right",
    });
    render(
      <DockPopover side="right" icon="LayoutList" trackingId="test.toggle" />,
    );
    await user.click(screen.getByRole("button", { name: "Projects" }));

    await typeThenEscape(user);
    expect(searchBox()).toHaveValue("");

    await user.keyboard("{Escape}");
    expect(searchBox()).toBeNull();
  });

  it("clears on Escape and leaves a collapsed dock's flyout open, which the next Escape closes", async () => {
    const user = userEvent.setup();
    stores.windows?.openWindow(<Search />, {
      id: "projects",
      title: "Projects",
      defaultDockState: "left",
      miniContent: <button type="button">Show projects</button>,
    });
    render(<CollapsedDockWindowMini windowId="projects" dockSide="left" />);
    await user.click(screen.getByRole("button", { name: "Show projects" }));

    await typeThenEscape(user);
    expect(searchBox()).toHaveValue("");

    await user.keyboard("{Escape}");
    expect(searchBox()).toBeNull();
  });
});
