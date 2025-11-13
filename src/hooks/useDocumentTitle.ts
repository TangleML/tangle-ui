import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

type TitleConfig = {
  [key: string]: string | ((params: Record<string, string>) => string);
};

const defaultTitles: TitleConfig = {
  "/": "Tangle - Pipeline Studio",
  "/editor/$name": (params) => `Tangle - ${params.name || "New Pipeline"}`,
  "/runs/$id": (params) => `Tangle - ${params.id}`,
};

/**
 * Set document title directly
 * @param title The new title to set
 * @param suffix Optional suffix to append to the title
 */
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

    // Combine default titles with custom titles
    const allTitles = { ...defaultTitles, ...titles };

    // Find matching route pattern
    for (const [route, titleValue] of Object.entries(allTitles)) {
      // Convert route pattern to regex
      const pattern = route.replace(/\//, "\\/").replace(/\$\w+/g, "([^/]+)");
      const regex = new RegExp(`^${pattern}$`);

      if (regex.test(currentRoute)) {
        // Extract params from the URL
        const paramNames =
          route.match(/\$(\w+)/g)?.map((p) => p.substring(1)) || [];
        const paramValues = currentRoute.match(regex)?.slice(1) || [];
        const params = Object.fromEntries(
          paramNames.map((name, i) => [name, paramValues[i]]),
        );

        // Set title based on route match
        title =
          typeof titleValue === "function" ? titleValue(params) : titleValue;
        break;
      }
    }

    // Use matching title or default to current document title
    const newTitle = title || document.title;

    // Add suffix if provided
    setDocumentTitle(newTitle, suffix);

    return () => {
      // No cleanup needed, as we'll update on each route change
    };
  }, [routerState.resolvedLocation?.pathname, titles, suffix]);
}
