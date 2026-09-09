import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installRawSource, installSource } from "@/config/noticeTestSource";
import { resetHiddenNoticesForTests } from "@/hooks/useHiddenNotices";
import { resetNoticeStateForTests } from "@/hooks/useNotices";

import { NoticeBanners } from "./NoticeBanners";

describe("<NoticeBanners />", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    resetHiddenNoticesForTests();
    resetNoticeStateForTests();
    delete window.__TANGLE_NOTICE_SOURCE__;
  });

  it("renders no DOM node when no source is installed", () => {
    const { container } = render(<NoticeBanners />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("notice-banners")).not.toBeInTheDocument();
  });

  it("renders no DOM node when the source declares an unsupported version", () => {
    installRawSource({
      version: 2,
      getSnapshot: () => [{ id: "a", title: "Later contract", body: "" }],
      subscribe: () => () => {},
    });

    const { container } = render(<NoticeBanners />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders a source that rebuilds its array on every read", () => {
    const notices = [{ id: "a", title: "Scheduled maintenance", body: "" }];
    installRawSource({
      version: 1,
      getSnapshot: () => notices.map((notice) => ({ ...notice })),
      subscribe: () => () => {},
    });

    render(<NoticeBanners />);

    expect(screen.getByText("Scheduled maintenance")).toBeInTheDocument();
  });

  it("shows every notice as a banner rather than capping the list", () => {
    installSource(
      ["a", "b", "c", "d", "e", "f"].map((id) => ({
        id,
        title: `Notice ${id}`,
        body: "",
        variant: "error" as const,
      })),
    );

    render(<NoticeBanners />);

    expect(screen.getAllByTestId("info-box-title")).toHaveLength(6);
    expect(screen.getByText("Notice f")).toBeInTheDocument();
  });

  it("promotes the cards in severity order", () => {
    installSource([
      { id: "a", title: "Nice to know", body: "", variant: "info" },
      { id: "b", title: "Worked", body: "", variant: "success" },
      { id: "c", title: "Everything is broken", body: "", variant: "error" },
      { id: "d", title: "Heads up", body: "", variant: "warning" },
    ]);

    render(<NoticeBanners />);

    expect(
      screen.getAllByTestId("info-box-title").map((el) => el.textContent),
    ).toEqual(["Everything is broken", "Heads up", "Worked", "Nice to know"]);
  });

  it("leaves clearing the banners and opening the full list to the header", () => {
    installSource([{ id: "a", title: "Only notice", body: "" }]);

    render(<NoticeBanners />);

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByLabelText("Hide notice")).toBeInTheDocument();
  });

  it("renders a brief body inline as Markdown", () => {
    installSource([
      {
        id: "a",
        title: "Scheduled maintenance",
        body: "Submissions paused **09:00-11:00 UTC**.",
      },
    ]);

    render(<NoticeBanners />);

    expect(screen.getByText("09:00-11:00 UTC").tagName).toBe("STRONG");
  });

  it("renders a long body inline rather than truncating it", () => {
    installSource([
      {
        id: "a",
        title: "Release notes",
        body: `Line one\n\n${"detail ".repeat(40)}`,
      },
    ]);

    render(<NoticeBanners />);

    expect(screen.getByText("Line one")).toBeInTheDocument();
  });

  it("scrolls a long body within the card, leaving the action in place", () => {
    installSource([
      {
        id: "a",
        title: "Release notes",
        body: `Line one\n\n${"detail ".repeat(40)}`,
        action: { url: "https://example.com", text: "Read more" },
      },
    ]);

    render(<NoticeBanners />);

    const body = screen.getByTestId("notice-body");
    const action = screen.getByRole("link");

    expect(body).toHaveClass("overflow-y-auto");
    expect(body).not.toContainElement(action);
    expect(screen.getByTestId("notice-banners")).not.toHaveClass(
      "overflow-y-auto",
    );
  });

  it("does not render raw HTML embedded in the body", () => {
    installSource([
      {
        id: "a",
        title: "Notice",
        body: "<script>window.__noticeXss = true;</script><b>bold</b>",
      },
    ]);

    const { container } = render(<NoticeBanners />);

    expect(container.querySelector("script")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.queryByText("bold")).not.toBeInTheDocument();
    expect(
      (window as unknown as Record<string, unknown>).__noticeXss,
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

    render(<NoticeBanners />);

    const link = screen.getByRole("link", {
      name: "Read the notes: Scheduled maintenance",
    });

    expect(link).toHaveAttribute("href", "https://example.com/notes");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("offers to hide any notice from the banners, but never to retire one", () => {
    installSource([
      { id: "a", title: "Scheduled maintenance", body: "", dismissible: true },
      { id: "b", title: "Mandatory notice", body: "" },
    ]);

    render(<NoticeBanners />);

    expect(screen.getAllByLabelText("Hide notice")).toHaveLength(2);
    expect(screen.queryByLabelText("Dismiss")).not.toBeInTheDocument();
  });

  it("keeps the remaining banners when notices are hidden", () => {
    installSource([
      { id: "a", title: "First", body: "", variant: "error" },
      { id: "b", title: "Second", body: "", variant: "warning" },
      { id: "c", title: "Third", body: "", variant: "info" },
    ]);

    render(<NoticeBanners />);
    fireEvent.click(screen.getAllByLabelText("Hide notice")[0]!);

    expect(
      screen.getAllByTestId("info-box-title").map((el) => el.textContent),
    ).toEqual(["Second", "Third"]);

    fireEvent.click(screen.getAllByLabelText("Hide notice")[0]!);

    expect(screen.getByTestId("info-box-title")).toHaveTextContent("Third");
  });

  it("keeps a hidden dismissible notice off the banners across a remount", () => {
    installSource([
      { id: "a", title: "Scheduled maintenance", body: "", dismissible: true },
    ]);

    render(<NoticeBanners />);
    fireEvent.click(screen.getByLabelText("Hide notice"));

    cleanup();
    const { container } = render(<NoticeBanners />);

    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem("hidden-notices") ?? "").toContain("a");
  });

  it("hides a non-dismissible notice without retiring it for good", () => {
    installSource([{ id: "a", title: "Mandatory notice", body: "" }]);

    render(<NoticeBanners />);
    fireEvent.click(screen.getByLabelText("Hide notice"));

    expect(screen.queryByTestId("notice-banners")).not.toBeInTheDocument();
    expect(localStorage.getItem("hidden-notices") ?? "").not.toContain("a");
  });

  it("picks up a source installed after mount", () => {
    render(<NoticeBanners />);

    expect(screen.queryByTestId("notice-banners")).not.toBeInTheDocument();

    act(() => {
      installSource([{ id: "a", title: "Scheduled maintenance", body: "" }]);
    });

    expect(screen.getByText("Scheduled maintenance")).toBeInTheDocument();
  });
});
