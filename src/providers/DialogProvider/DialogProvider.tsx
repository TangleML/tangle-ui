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

        navigate({
          search: {
            ...searchParams,
            [DIALOG_SEARCH_PARAMS.DIALOG_KEY]: config.routeKey,
            [DIALOG_SEARCH_PARAMS.DIALOG_ID]: id,
          } as any,
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

    setStack((prev) => {
      const dialogIndex = prev.findIndex((d) => d.id === id);
      const dialog = dialogIndex !== -1 ? prev[dialogIndex] : undefined;
      const remainingStack = prev.filter((d) => d.id !== id);

      if (dialog?.routeKey) {
        const nextRoutedDialog = getTopRoutedDialog(remainingStack);

        setTimeout(() => {
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

          navigate({ search: nextSearch as any });
          closingDialogIds.current.delete(id);
        }, 0);
      } else {
        closingDialogIds.current.delete(id);
      }

      return remainingStack;
    });
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

    navigate({
      search: omitSearchParams(
        searchParamsRef.current,
        DIALOG_PARAM_KEYS,
      ) as any,
    });
  };

  useDialogRouter(
    stack,
    cancel,
    pendingDialogIds,
    closingDialogIds,
    disableRouterSync,
  );

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
