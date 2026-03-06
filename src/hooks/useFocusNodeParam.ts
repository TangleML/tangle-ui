import { useCallback, useSyncExternalStore } from "react";

const FOCUS_PARAM = "focus";

const getSnapshot = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get(FOCUS_PARAM) ?? undefined;
};

const subscribe = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};

const updateSearchParam = (taskId: string | undefined) => {
  const url = new URL(window.location.href);
  if (taskId) {
    url.searchParams.set(FOCUS_PARAM, taskId);
  } else {
    url.searchParams.delete(FOCUS_PARAM);
  }
  window.history.replaceState(window.history.state, "", url.toString());
};

export const useFocusNodeParam = () => {
  const focusNodeId = useSyncExternalStore(subscribe, getSnapshot);

  const setFocusNode = useCallback((taskId: string) => {
    updateSearchParam(taskId);
  }, []);

  const clearFocusNode = useCallback(() => {
    updateSearchParam(undefined);
  }, []);

  return { focusNodeId, setFocusNode, clearFocusNode };
};
