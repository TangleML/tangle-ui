import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

type TitleConfig = {
  [key: string]: string | ((params: Record<string, string>) => string);
};

const defaultTitles: TitleConfig = {
  "/": "Tangle - Pipeline Studio",
  "/editor/$pipelineName": (params) =>
    `Tangle - ${params.pipelineName || "New Pipeline"}`,
  "/runs/$id": (params) => `Tangle - ${params.id}`,
};

function setDocumentTitle(title: string, suffix?: string) {
  document.title = suffix ? `${title} ${suffix}` : title;
}

/**
 * Hook to update document title based on the current route
 *
 * @param titles Optional custom title configuration to override defaults
 * @param suffix Optional suffix to append to all titles
 */
export function useDocumentTitle(titles: TitleConfig = {}, suffix?: string) {
  const routerState = useRouterState();

  useEffect(() => {
    const currentRoute = routerState.resolvedLocation?.pathname || "";
    let title: string | undefined;

    const allTitles = { ...defaultTitles, ...titles };

    for (const [route, titleValue] of Object.entries(allTitles)) {
      const pattern = route.replace(/\//, "\\/").replace(/\$\w+/g, "([^/]+)");
      const regex = new RegExp(`^${pattern}$`);

      if (regex.test(currentRoute)) {
        const paramNames =
          route.match(/\$(\w+)/g)?.map((p) => p.substring(1)) || [];
        const paramValues = currentRoute.match(regex)?.slice(1) || [];
        const params = Object.fromEntries(
          paramNames.map((name, i) => [name, paramValues[i]]),
        );

        title =
          typeof titleValue === "function" ? titleValue(params) : titleValue;
        break;
      }
    }

    const newTitle = title || document.title;

    setDocumentTitle(newTitle, suffix);

    return () => {
      // No cleanup needed, as we'll update on each route change
    };
  }, [routerState.resolvedLocation?.pathname, titles, suffix]);
}
