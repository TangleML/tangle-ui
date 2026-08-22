import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BANNER_SOURCE_EVENT,
  type TangleBanner,
  type TangleBannerSource,
} from "@/config/banners";
import { CONTENT_OFFSET_VAR } from "@/utils/constants";

import { BannerRegion } from "./BannerRegion";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

function enableFloating() {
  localStorage.setItem(
    "betaFlags",
    JSON.stringify({ "floating-banners": true }),
  );
}

function contentOffset() {
  return document.documentElement.style.getPropertyValue(CONTENT_OFFSET_VAR);
}

function installSource(banners: Partial<TangleBanner>[]) {
  const source = {
    version: 1,
    getSnapshot: () => banners,
    subscribe: () => () => {},
  };

  window.__TANGLE_BANNER_SOURCE__ = source as unknown as TangleBannerSource;
  window.dispatchEvent(new CustomEvent(BANNER_SOURCE_EVENT));
}

describe("<BannerRegion />", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    delete window.__TANGLE_BANNER_SOURCE__;
    document.documentElement.style.removeProperty(CONTENT_OFFSET_VAR);
  });

  it("renders no DOM node when no source is installed", () => {
    const { container } = render(<BannerRegion />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("banner-region")).not.toBeInTheDocument();
  });

  it("renders no DOM node when the source declares an unsupported version", () => {
    window.__TANGLE_BANNER_SOURCE__ = {
      version: 2,
      getSnapshot: () => [{ id: "a", title: "Later contract", body: "" }],
      subscribe: () => () => {},
    } as unknown as TangleBannerSource;

    const { container } = render(<BannerRegion />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders one InfoBox per banner inside a polite live region", () => {
    installSource([
      { id: "a", title: "Scheduled maintenance", body: "", variant: "warning" },
      { id: "b", title: "New feature", body: "", variant: "success" },
    ]);

    render(<BannerRegion />);

    expect(screen.getByTestId("info-box-warning")).toBeInTheDocument();
    expect(screen.getByTestId("info-box-success")).toBeInTheDocument();
    expect(screen.getAllByTestId("info-box-title")).toHaveLength(2);

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("renders the body as Markdown", () => {
    installSource([
      {
        id: "a",
        title: "Scheduled maintenance",
        body: "Submissions paused **09:00-11:00 UTC**.",
      },
    ]);

    render(<BannerRegion />);

    expect(screen.getByText("09:00-11:00 UTC").tagName).toBe("STRONG");
  });

  it("does not render raw HTML embedded in the body", () => {
    const { container } = render(<BannerRegion />);
    cleanup();

    installSource([
      {
        id: "a",
        title: "Notice",
        body: "<script>window.__bannerXss = true;</script><b>bold</b>",
      },
    ]);

    render(<BannerRegion />);

    expect(container.querySelector("script")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.queryByText("bold")).not.toBeInTheDocument();
    expect(
      screen.getByText(/window.__bannerXss = true;/, { exact: false }),
    ).toBeInTheDocument();
    expect(
      (window as unknown as Record<string, unknown>).__bannerXss,
    ).toBeUndefined();
  });

  it("renders an action link with an accessible name that includes the title", () => {
    installSource([
      {
        id: "a",
        title: "Scheduled maintenance",
        body: "",
        action: { url: "https://example.com/notes", text: "Read the notes" },
      },
    ]);

    render(<BannerRegion />);

    const link = screen.getByRole("link", {
      name: "Read the notes: Scheduled maintenance",
    });

    expect(link).toHaveAttribute("href", "https://example.com/notes");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("has no dismiss control when the banner is not dismissible", () => {
    installSource([
      { id: "a", title: "Scheduled maintenance", body: "", dismissible: false },
    ]);

    render(<BannerRegion />);

    expect(screen.queryByLabelText("Dismiss")).not.toBeInTheDocument();
  });

  it("hides a dismissed banner and keeps it hidden across a remount", () => {
    installSource([
      { id: "a", title: "Scheduled maintenance", body: "", dismissible: true },
    ]);

    render(<BannerRegion />);
    fireEvent.click(screen.getByLabelText("Dismiss"));

    expect(screen.queryByTestId("banner-region")).not.toBeInTheDocument();

    cleanup();
    const { container } = render(<BannerRegion />);

    expect(container).toBeEmptyDOMElement();
  });

  describe("presentation", () => {
    it("renders inline and publishes a content offset by default", () => {
      installSource([{ id: "a", title: "Scheduled maintenance", body: "" }]);

      render(<BannerRegion />);

      expect(screen.getByTestId("banner-region")).toHaveAttribute(
        "data-presentation",
        "inline",
      );
      expect(contentOffset()).not.toBe("");
    });

    it("renders floating without a content offset when the flag is on", () => {
      enableFloating();
      installSource([{ id: "a", title: "Scheduled maintenance", body: "" }]);

      render(<BannerRegion />);
      const region = screen.getByTestId("banner-region");

      expect(region).toHaveAttribute("data-presentation", "floating");
      expect(region).toHaveClass("fixed");
      expect(contentOffset()).toBe("");
    });

    it("drops the content offset once every banner is dismissed", () => {
      installSource([
        {
          id: "a",
          title: "Scheduled maintenance",
          body: "",
          dismissible: true,
        },
      ]);

      render(<BannerRegion />);
      expect(contentOffset()).not.toBe("");

      fireEvent.click(screen.getByLabelText("Dismiss"));

      expect(contentOffset()).toBe("");
    });
  });

  it("picks up a source installed after mount", () => {
    render(<BannerRegion />);

    expect(screen.queryByTestId("banner-region")).not.toBeInTheDocument();

    act(() => {
      installSource([{ id: "a", title: "Scheduled maintenance", body: "" }]);
    });

    expect(screen.getByText("Scheduled maintenance")).toBeInTheDocument();
  });
});
