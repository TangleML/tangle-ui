import { afterEach, describe, expect, test } from "vitest";

import { hasTextSelection, isEditableTarget } from "./shortcutUtils";

function editableAtWindow(root: Node, from: EventTarget = root): boolean {
  document.body.appendChild(root);
  let result: boolean | undefined;
  const listen = (event: Event) => {
    result = isEditableTarget(event);
  };

  window.addEventListener("keydown", listen);
  from.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, composed: true }),
  );
  window.removeEventListener("keydown", listen);
  root.parentNode?.removeChild(root);

  if (result === undefined) throw new Error("event never reached window");
  return result;
}

function selectTextOf(element: HTMLElement): void {
  document.body.appendChild(element);
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe("hasTextSelection", () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    document.body.replaceChildren();
  });

  test("is false with nothing selected", () => {
    expect(hasTextSelection()).toBe(false);
  });

  test("is true for selected text", () => {
    const message = document.createElement("p");
    message.textContent = "the run failed on step two";
    selectTextOf(message);

    expect(hasTextSelection()).toBe(true);
  });

  test("is false for a collapsed selection in an empty element", () => {
    selectTextOf(document.createElement("p"));

    expect(hasTextSelection()).toBe(false);
  });
});

describe("isEditableTarget", () => {
  test("is false for an event that reached no element", () => {
    expect(isEditableTarget(new KeyboardEvent("keydown"))).toBe(false);
  });

  test("is true for inputs and textareas", () => {
    expect(editableAtWindow(document.createElement("input"))).toBe(true);
    expect(editableAtWindow(document.createElement("textarea"))).toBe(true);
  });

  test("is false for a plain div", () => {
    expect(editableAtWindow(document.createElement("div"))).toBe(false);
  });

  test("is true inside a Monaco editor", () => {
    const editor = document.createElement("div");
    editor.className = "monaco-editor";
    const inner = editor.appendChild(document.createElement("div"));

    expect(editableAtWindow(editor, inner)).toBe(true);
  });

  test("is true for anything behind a custom element's shadow root", () => {
    const host = document.createElement("tangent-chat");
    const shadow = host.attachShadow({ mode: "open" });
    const inner = shadow.appendChild(document.createElement("div"));

    expect(editableAtWindow(host, inner)).toBe(true);
  });

  test("is true for the custom element host itself", () => {
    expect(editableAtWindow(document.createElement("tangent-chat"))).toBe(true);
  });

  test("is false for the editor, which is light-DOM children of a custom element", () => {
    const provider = document.createElement("tangent-provider");
    const canvas = provider.appendChild(document.createElement("div"));

    expect(editableAtWindow(provider, canvas)).toBe(false);
  });
});
