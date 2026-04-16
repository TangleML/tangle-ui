import { useNavigate, useSearch } from "@tanstack/react-router";
import { type ReactNode, useRef, useState } from "react";

import { DialogContext } from "./DialogContext";
import DialogRenderer from "./DialogRenderer";
import {
  type DialogConfig,
  type DialogContextValue,
  type DialogInstance,
  type PromiseCallbacks,
} from "./types";
import { useDialogRouter } from "./useDialogRouter";
import {
  createCancellationError,
  DIALOG_PARAM_KEYS,
  DIALOG_SEARCH_PARAMS,
  generateDialogId,
  getTopRoutedDialog,
  omitSearchParams,
} from "./utils";

interface DialogProviderProps {
  children: ReactNode;
  disableRouterSync?: boolean;
}

export function DialogProvider({
  children,
  disableRouterSync = false,
}: DialogProviderProps) {
  const [stack, setStack] = useState<DialogInstance[]>([]);
  const resolvers = useRef(new Map<string, PromiseCallbacks>());
  const pendingDialogIds = useRef(new Set<string>());
  const closingDialogIds = useRef(new Set<string>());
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as Record<string, unknown>;
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  // Dialog routing manages search params dynamically across arbitrary routes.
  // TanStack Router's strict per-route typing cannot express this, so we
  // funnel all dialog navigations through a single type boundary.
  const navigateSearch = (search: Record<string, unknown>) => {
    navigate({ search } as never);
  };

  const open = async <T, TProps = {}>(
    config: DialogConfig<T, TProps>,
  ): Promise<T> => {
    const id = generateDialogId();

    return new Promise<T>((resolve, reject) => {
      const dialog = {
        ...config,
        id,
        resolve,
        reject,
      } as DialogInstance;

      setStack((prev) => [...prev, dialog]);

      if (config.routeKey) {
        pendingDialogIds.current.add(id);

        navigateSearch({
          ...searchParams,
          [DIALOG_SEARCH_PARAMS.DIALOG_KEY]: config.routeKey,
          [DIALOG_SEARCH_PARAMS.DIALOG_ID]: id,
        });
      }

      resolvers.current.set(id, { resolve, reject });
    });
  };

  const close = (id: string, result?: unknown) => {
    const resolver = resolvers.current.get(id);
    if (resolver) {
      resolver.resolve(result);
      resolvers.current.delete(id);
    }

    closingDialogIds.current.add(id);

    // Compute navigation intent from current stack before updating state.
    // This is safe because close() runs synchronously before React commits
    // the state update.
    const dialog = stack.find((d) => d.id === id);
    const remainingStack = stack.filter((d) => d.id !== id);

    setStack((prev) => prev.filter((d) => d.id !== id));

    if (dialog?.routeKey) {
      const nextRoutedDialog = getTopRoutedDialog(remainingStack);
      const baseSearch = omitSearchParams(
        searchParamsRef.current,
        DIALOG_PARAM_KEYS,
      );

      const nextSearch = nextRoutedDialog
        ? {
            ...baseSearch,
            [DIALOG_SEARCH_PARAMS.DIALOG_KEY]: nextRoutedDialog.routeKey,
            [DIALOG_SEARCH_PARAMS.DIALOG_ID]: nextRoutedDialog.id,
          }
        : baseSearch;

      navigateSearch(nextSearch);
    }

    closingDialogIds.current.delete(id);
  };

  const cancel = (id: string) => {
    const resolver = resolvers.current.get(id);
    if (resolver) {
      resolver.reject(createCancellationError());
      resolvers.current.delete(id);
    }

    setStack((prev) => prev.filter((d) => d.id !== id));
  };

  const closeAll = () => {
    setStack((prev) => {
      prev.forEach((dialog) => {
        const resolver = resolvers.current.get(dialog.id);
        if (resolver) {
          resolver.reject(new Error("All dialogs closed"));
          resolvers.current.delete(dialog.id);
        }
      });
      return [];
    });

    navigateSearch(
      omitSearchParams(searchParamsRef.current, DIALOG_PARAM_KEYS),
    );
  };

  useDialogRouter({
    stack,
    cancel,
    pendingDialogIds,
    closingDialogIds,
    disabled: disableRouterSync,
  });

  const value: DialogContextValue = {
    open,
    close,
    cancel,
    closeAll,
    stack,
  };

  return (
    <DialogContext.Provider value={value}>
      {children}
      <DialogRenderer stack={stack} onClose={close} />
    </DialogContext.Provider>
  );
}
