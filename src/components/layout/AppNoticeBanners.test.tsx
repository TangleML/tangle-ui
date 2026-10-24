import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installSource } from "@/config/noticeTestSource";
import { resetHiddenNoticesForTests } from "@/hooks/useHiddenNotices";
import { resetNoticeStateForTests } from "@/hooks/useNotices";
import { NOTICE_BANNERS_HEIGHT_VAR } from "@/utils/layout";

import { AppNoticeBanners } from "./AppNoticeBanners";

const mockPathname = vi.hoisted(() => ({ value: "/" }));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useLocation: () => ({ pathname: mockPathname.value }),
}));

class ResizeObserverMock {
  constructor(private readonly callback: () => void) {}
  observe() {
    this.callback();
  }
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

const rootHeightVar = () =>
  document.documentElement.style.getPropertyValue(NOTICE_BANNERS_HEIGHT_VAR);

describe("<AppNoticeBanners />", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(120);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    resetHiddenNoticesForTests();
    resetNoticeStateForTests();
    delete window.__TANGLE_NOTICE_SOURCE__;
    mockPathname.value = "/";
  });

  it.each(["/tangent/project-1", "/settings/backend", "/pipelines"])(
    "shows notices on %s",
    (pathname) => {
      mockPathname.value = pathname;
      installSource([{ id: "a", title: "Instances are moving", body: "" }]);

      render(<AppNoticeBanners />);

      expect(screen.getByTestId("notice-banners")).toBeInTheDocument();
      expect(screen.getByText("Instances are moving")).toBeInTheDocument();
    },
  );

  it.each(["/editor/my-pipeline", "/runs/123", "/tour/intro"])(
    "leaves the full-screen view at %s to the notice inbox",
    (pathname) => {
      mockPathname.value = pathname;
      installSource([{ id: "a", title: "Instances are moving", body: "" }]);

      render(<AppNoticeBanners />);

      expect(screen.queryByTestId("notice-banners")).not.toBeInTheDocument();
      expect(rootHeightVar()).toBe("");
    },
  );

  it("reserves the banners' height for viewport-sized layouts", () => {
    mockPathname.value = "/tangent/project-1";
    installSource([{ id: "a", title: "Instances are moving", body: "" }]);

    const { unmount } = render(<AppNoticeBanners />);

    expect(rootHeightVar()).toBe("120px");

    unmount();

    expect(rootHeightVar()).toBe("");
  });

  it("keeps a hidden notice off the banners on the next page", () => {
    mockPathname.value = "/settings/backend";
    installSource([
      { id: "a", title: "Instances are moving", body: "", dismissible: true },
    ]);

    render(<AppNoticeBanners />);
    fireEvent.click(screen.getByLabelText("Hide notice"));

    cleanup();
    mockPathname.value = "/tangent/project-1";
    render(<AppNoticeBanners />);

    expect(screen.queryByTestId("notice-banners")).not.toBeInTheDocument();
  });
});
