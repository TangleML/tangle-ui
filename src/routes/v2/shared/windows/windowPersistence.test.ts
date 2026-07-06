import { afterEach, describe, expect, it } from "vitest";

import { clearLayout, TOUR_WINDOW_LAYOUT_ID } from "./windowPersistence";

afterEach(() => {
  localStorage.clear();
});

describe("clearLayout", () => {
  it("removes only the targeted layout key", () => {
    localStorage.setItem("window-layout-editor", '{"editor":true}');
    localStorage.setItem("window-layout-tour", '{"tour":true}');

    clearLayout(TOUR_WINDOW_LAYOUT_ID);

    expect(localStorage.getItem("window-layout-tour")).toBeNull();
    expect(localStorage.getItem("window-layout-editor")).toBe(
      '{"editor":true}',
    );
  });

  it("is a no-op when the layout key is absent", () => {
    expect(() => clearLayout(TOUR_WINDOW_LAYOUT_ID)).not.toThrow();
    expect(localStorage.getItem("window-layout-tour")).toBeNull();
  });

  it("keeps the tour layout id distinct from the editor's", () => {
    expect(TOUR_WINDOW_LAYOUT_ID).not.toBe("editor");
  });
});
