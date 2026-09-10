export function isDialogOpen(): boolean {
  return (
    document.querySelector('[role="dialog"],[role="alertdialog"]') !== null
  );
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable ||
    target.closest(".monaco-editor") !== null
  );
}
