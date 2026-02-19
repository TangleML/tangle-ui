import { useNavigate, useSearch } from "@tanstack/react-router";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import type { DialogInstance } from "./types";
import {
  DIALOG_PARAM_KEYS,
  DIALOG_SEARCH_PARAMS,
  getRoutedDialogsAbove,
  getTopRoutedDialog,
  omitSearchParams,
} from "./utils";

function isPendingOrClosing(
  dialogId: string,
  pendingIds: RefObject<Set<string>>,
  closingIds: RefObject<Set<string>>,
): boolean {
  return (
    Boolean(pendingIds.current?.has(dialogId)) ||
    Boolean(closingIds.current?.has(dialogId))
  );
}

export function useDialogRouter(
  stack: DialogInstance[],
  cancel: (id: string) => void,
  pendingDialogIds: RefObject<Set<string>>,
  closingDialogIds: RefObject<Set<string>>,
  disabled: boolean = false,
) {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as Record<string, unknown>;
  const previousStackLength = useRef(stack.length);

  // Handle URL changes
  useEffect(() => {
    if (disabled) return;

    const dialogId = searchParams[DIALOG_SEARCH_PARAMS.DIALOG_ID] as
      | string
      | undefined;
    const dialogKey = searchParams[DIALOG_SEARCH_PARAMS.DIALOG_KEY] as
      | string
      | undefined;

    // If URL now has the dialogId we were waiting for, clear the pending flag
    // This must happen BEFORE checking cancel conditions
    if (dialogId && pendingDialogIds.current?.has(dialogId)) {
      pendingDialogIds.current.delete(dialogId);
      return;
    }

    // If URL has no dialog params but we have dialogs with routeKey open, cancel them
    // This happens when user clicks browser back button
    if (!dialogId && !dialogKey && stack.length > 0) {
      const topDialogWithRoute = getTopRoutedDialog(stack);

      if (topDialogWithRoute) {
        // Skip if this dialog is still pending (being opened) to avoid race condition
        if (pendingDialogIds.current?.has(topDialogWithRoute.id)) {
          return;
        }

        // Skip if any dialog is currently being closed - the close function will handle URL
        if (closingDialogIds.current?.size) {
          return;
        }

        cancel(topDialogWithRoute.id);
      }
      return;
    }

    // If URL has a dialog ID that matches a dialog in the stack, but there are
    // routed dialogs above it, close the top one (handles nested dialog back navigation)
    if (dialogId) {
      const matchingDialogIndex = stack.findIndex((d) => d.id === dialogId);

      if (matchingDialogIndex !== -1) {
        const routedDialogsAbove = getRoutedDialogsAbove(
          stack,
          matchingDialogIndex,
        );

        if (routedDialogsAbove.length > 0) {
          const topRoutedDialog =
            routedDialogsAbove[routedDialogsAbove.length - 1];

          if (
            !isPendingOrClosing(
              topRoutedDialog.id,
              pendingDialogIds,
              closingDialogIds,
            )
          ) {
            cancel(topRoutedDialog.id);
          }
        }
        return;
      }
    }

    // If URL has dialog params but no matching dialog in stack AND not pending/closing, clean URL
    if (
      dialogId &&
      !stack.find((d) => d.id === dialogId) &&
      !isPendingOrClosing(dialogId, pendingDialogIds, closingDialogIds)
    ) {
      navigate({
        search: omitSearchParams(searchParams, DIALOG_PARAM_KEYS) as any,
      });
    }
  }, [
    disabled,
    searchParams,
    stack,
    cancel,
    navigate,
    pendingDialogIds,
    closingDialogIds,
  ]);

  // Handle stack changes
  useEffect(() => {
    if (disabled) return;

    // If stack shrunk (dialog closed programmatically), update URL
    if (stack.length < previousStackLength.current) {
      const dialogIdInUrl = searchParams[DIALOG_SEARCH_PARAMS.DIALOG_ID] as
        | string
        | undefined;

      // Only clean URL if the dialog in the URL is no longer in the stack
      // AND we're not in the middle of closing a dialog (which will handle URL itself)
      if (
        dialogIdInUrl &&
        !stack.find((d) => d.id === dialogIdInUrl) &&
        !closingDialogIds.current?.has(dialogIdInUrl)
      ) {
        navigate({
          search: omitSearchParams(searchParams, DIALOG_PARAM_KEYS) as any,
        });
      }
    }
    previousStackLength.current = stack.length;
  }, [disabled, stack.length, navigate, searchParams, stack, closingDialogIds]);
}
