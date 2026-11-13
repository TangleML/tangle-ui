import { type RefObject, useEffect } from "react";

// Menus and dialogs a popover opens are portaled outside it, so working in one
// is not a press away from it.
const LAYERS_OPENED_FROM_POPOVER =
  '[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"], [data-radix-popper-content-wrapper]';

/** What holds focus, looking inside shadow roots, where a frame may sit. */
function focusedElement(): Element | null {
  let element = document.activeElement;
  while (element?.shadowRoot?.activeElement) {
    element = element.shadowRoot.activeElement;
  }
  return element;
}

/**
 * Closes a popover on a press outside it, or when focus moves into a frame. Radix listens for outside presses as they bubble, but a pipeline
 * canvas stops them first and a frame never sends them up at all, so this
 * listens ahead of both. A press on any of `refs` isn't outside.
 */
export function useDismissOnOutsidePress({
  open,
  refs,
  onDismiss,
}: {
  open: boolean;
  refs: RefObject<Element | null>[];
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const dismissIfOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      if (target.closest(LAYERS_OPENED_FROM_POPOVER)) return;
      onDismiss();
    };
    // The window also blurs for another app, devtools or a file chooser,
    // none of which is a press on this page; a frame taking focus is.
    let checking: ReturnType<typeof setTimeout> | undefined;
    const dismissIfFrameTookFocus = () => {
      clearTimeout(checking);
      checking = setTimeout(() => {
        if (focusedElement() instanceof HTMLIFrameElement) onDismiss();
      });
    };
    document.addEventListener("pointerdown", dismissIfOutside, true);
    window.addEventListener("blur", dismissIfFrameTookFocus);
    return () => {
      clearTimeout(checking);
      document.removeEventListener("pointerdown", dismissIfOutside, true);
      window.removeEventListener("blur", dismissIfFrameTookFocus);
    };
  }, [open, refs, onDismiss]);
}
