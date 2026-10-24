import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installSource } from "@/config/noticeTestSource";
import { resetNoticeStateForTests } from "@/hooks/useNotices";

import { DashboardHomeView } from "./DashboardHomeView";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useProjectsEnabled: () => false,
}));

vi.mock("@/hooks/useRecentlyViewed", () => ({
  useRecentlyViewed: () => ({ recentlyViewed: [] }),
  useRecentlyUsed: () => ({ recentlyUsed: [] }),
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock("@/components/Home/RunSection/RunSection", () => ({
  RunSection: () => null,
}));

vi.mock("./FavoritesPreview", () => ({ FavoritesPreview: () => null }));

vi.mock("./ProjectsPreview", () => ({ ProjectsPreview: () => null }));

describe("<DashboardHomeView />", () => {
  afterEach(() => {
    cleanup();
    resetNoticeStateForTests();
    delete window.__TANGLE_NOTICE_SOURCE__;
  });

  it("leaves notices to the app-wide banners", () => {
    installSource([{ id: "a", title: "Instances are moving", body: "" }]);

    render(<DashboardHomeView />);

    expect(screen.getByText("Recently Viewed")).toBeInTheDocument();
    expect(screen.queryByTestId("notice-banners")).not.toBeInTheDocument();
    expect(screen.queryByText("Instances are moving")).not.toBeInTheDocument();
  });
});
