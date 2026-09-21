import useToastNotification from "@/hooks/useToastNotification";
import { copyToClipboard } from "@/utils/string";
import { getProjectUrl } from "@/utils/URL";

/**
 * Sharing a project is offered from the project's own page and from Tangent,
 * and both have to hand over the same link.
 */
export function useShareProjectAction(projectId: string): () => void {
  const notify = useToastNotification();

  return () => {
    copyToClipboard(getProjectUrl(projectId));
    notify("Project URL copied to clipboard", "success");
  };
}
