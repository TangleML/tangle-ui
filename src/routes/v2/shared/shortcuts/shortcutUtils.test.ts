import { describe, expect, test } from "vitest";

import { isEditableTarget } from "./shortcutUtils";

describe("isEditableTarget", () => {
  test("returns false for non-elements", () => {
    expect(isEditableTarget(null)).toBe(false);
  });

  test("returns true for inputs and textareas", () => {
    expect(isEditableTarget(document.createElement("input"))).toBe(true);
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
  });

  test("returns false for a plain div", () => {
    expect(isEditableTarget(document.createElement("div"))).toBe(false);
  });

  test("returns true for elements inside a Monaco editor", () => {
    const editor = document.createElement("div");
    editor.className = "monaco-editor";
    const inner = document.createElement("div");
    editor.appendChild(inner);
    document.body.appendChild(editor);

    expect(isEditableTarget(inner)).toBe(true);

    editor.remove();
  });
});
