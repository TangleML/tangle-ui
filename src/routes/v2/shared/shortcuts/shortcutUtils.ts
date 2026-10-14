function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable ||
    target.closest(".monaco-editor") !== null
  );
}

function hidesItsTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.shadowRoot !== null || target.localName.includes("-"))
  );
}

function crossesShadowBoundary(path: EventTarget[]): boolean {
  return path.some((node) => node instanceof ShadowRoot);
}

export function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return (
    selection !== null &&
    !selection.isCollapsed &&
    selection.toString().length > 0
  );
}

export function isEditableTarget(event: Event): boolean {
  const path = event.composedPath();
  const target = path[0] ?? event.target;
  return (
    isEditableElement(target) ||
    hidesItsTarget(target) ||
    crossesShadowBoundary(path)
  );
}
