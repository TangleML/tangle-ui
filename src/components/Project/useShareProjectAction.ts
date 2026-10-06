import useToastNotification from "@/hooks/useToastNotification";
import { copyToClipboard } from "@/utils/string";
import { getProjectUrl } from "@/utils/URL";

/** Offered from the project's page and from Tangent, which share one link. */
export function useShareProjectAction(projectId: string): () => void {
  const notify = useToastNotification();

  return () => {
    copyToClipboard(getProjectUrl(projectId));
    notify("Project URL copied to clipboard", "success");
  };
}
