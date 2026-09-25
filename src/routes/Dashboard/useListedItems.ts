import { useFlagValue } from "@/components/shared/Settings/useFlags";

/**
 * Hides rows for things the user can no longer reach, for the lists that mix
 * kinds — favourites and recently viewed. A project starred or visited while
 * Projects was on outlives the flag, and its row would otherwise link to a
 * page that redirects.
 *
 * Filters on the way out rather than deleting, so turning Projects back on
 * restores the history instead of making the user rebuild it.
 */
export function useListedItems<T extends { type: string }>(items: T[]): T[] {
  const projectsEnabled = useFlagValue("projects");

  return projectsEnabled
    ? items
    : items.filter((item) => item.type !== "project");
}
