import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const getFocusParam = (
  search: Record<string, unknown>,
): string | undefined => {
  if (typeof search.focus === "string") {
    return search.focus;
  }
  return undefined;
};

export const useNodeFocus = () => {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const focusParam = getFocusParam(search);

  useEffect(() => {
    if (!focusParam) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("[data-task-status-list]")
      ) {
        return;
      }

      const { focus: _, ...rest } = search;
      navigate({
        to: pathname,
        search: rest,
        replace: true,
      });
    };

    document.addEventListener("click", handleClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, [focusParam, navigate, pathname, search]);
};
