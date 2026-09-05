import { afterEach, describe, expect, test } from "vitest";

import { isDialogOpen, isEditableTarget } from "./shortcutUtils";

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

describe("isDialogOpen", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("returns false when nothing is open", () => {
    expect(isDialogOpen()).toBe(false);
  });

  test.each(["dialog", "alertdialog"])("detects an open %s", (role) => {
    const el = document.createElement("div");
    el.setAttribute("role", role);
    document.body.appendChild(el);

    expect(isDialogOpen()).toBe(true);
  });
});
