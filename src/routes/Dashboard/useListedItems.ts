import { useFlagValue } from "@/components/shared/Settings/useFlags";

/**
 * A project starred or visited while Projects was on outlives the flag, and its
 * row would otherwise link to a page that redirects. Filtered on the way out
 * rather than deleted, so turning the flag back on restores the history instead
 * of making the user rebuild it.
 */
export function useListedItems<T extends { type: string }>(items: T[]): T[] {
  const projectsEnabled = useFlagValue("projects");

  return projectsEnabled
    ? items
    : items.filter((item) => item.type !== "project");
}
