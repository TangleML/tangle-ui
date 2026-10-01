function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable ||
    target.closest(".monaco-editor") !== null
  );
}

function crossesCustomElement(path: EventTarget[]): boolean {
  return path.some(
    (node) =>
      node instanceof HTMLElement &&
      (node.shadowRoot !== null || node.localName.includes("-")),
  );
}

export function isEditableTarget(event: Event): boolean {
  const path = event.composedPath();
  return (
    isEditableElement(path[0] ?? event.target) || crossesCustomElement(path)
  );
}
