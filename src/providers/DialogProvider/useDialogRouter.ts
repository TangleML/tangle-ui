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

interface UseDialogRouterOptions {
  stack: DialogInstance[];
  cancel: (id: string) => void;
  pendingDialogIds: RefObject<Set<string>>;
  closingDialogIds: RefObject<Set<string>>;
  disabled?: boolean;
}

export function useDialogRouter({
  stack,
  cancel,
  pendingDialogIds,
  closingDialogIds,
  disabled = false,
}: UseDialogRouterOptions) {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as Record<string, unknown>;
  const previousStackLength = useRef(stack.length);

  // Dialog routing manages search params dynamically across arbitrary routes.
  // TanStack Router's strict per-route typing cannot express this, so we
  // funnel all dialog navigations through a single type boundary.
  const navigateSearch = (search: Record<string, unknown>) => {
    navigate({ search } as never);
  };

  // Handle URL changes
  useEffect(() => {
    if (disabled) return;

    const dialogId = searchParams[DIALOG_SEARCH_PARAMS.DIALOG_ID] as
      | string
      | undefined;
    const dialogKey = searchParams[DIALOG_SEARCH_PARAMS.DIALOG_KEY] as
      | string
      | undefined;

    if (dialogId && pendingDialogIds.current?.has(dialogId)) {
      pendingDialogIds.current.delete(dialogId);
      return;
    }

    // URL has no dialog params but we have dialogs with routeKey open — cancel them
    // (happens when user clicks browser back button)
    if (!dialogId && !dialogKey && stack.length > 0) {
      const topDialogWithRoute = getTopRoutedDialog(stack);

      if (topDialogWithRoute) {
        if (pendingDialogIds.current?.has(topDialogWithRoute.id)) {
          return;
        }

        if (closingDialogIds.current?.size) {
          return;
        }

        cancel(topDialogWithRoute.id);
      }
      return;
    }

    // URL has a dialog ID that matches a dialog in the stack, but there are
    // routed dialogs above it — close the top one (nested dialog back navigation)
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

    // URL has dialog params but no matching dialog in stack — clean URL
    if (
      dialogId &&
      !stack.find((d) => d.id === dialogId) &&
      !isPendingOrClosing(dialogId, pendingDialogIds, closingDialogIds)
    ) {
      navigateSearch(omitSearchParams(searchParams, DIALOG_PARAM_KEYS));
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

    if (stack.length < previousStackLength.current) {
      const dialogIdInUrl = searchParams[DIALOG_SEARCH_PARAMS.DIALOG_ID] as
        | string
        | undefined;

      if (
        dialogIdInUrl &&
        !stack.find((d) => d.id === dialogIdInUrl) &&
        !closingDialogIds.current?.has(dialogIdInUrl)
      ) {
        navigateSearch(omitSearchParams(searchParams, DIALOG_PARAM_KEYS));
      }
    }
    previousStackLength.current = stack.length;
  }, [disabled, stack.length, navigate, searchParams, stack, closingDialogIds]);
}
