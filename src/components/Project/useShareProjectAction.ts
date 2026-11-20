import useToastNotification from "@/hooks/useToastNotification";
import { copyToClipboard } from "@/utils/string";
import { getProjectUrl } from "@/utils/URL";

export function useShareProjectAction(projectId: string) {
  const notify = useToastNotification();

  return async (sessionId?: string) => {
    const subject = sessionId ? "Session" : "Project";
    try {
      await copyToClipboard(getProjectUrl(projectId, sessionId));
      notify(`${subject} URL copied to clipboard`, "success");
    } catch {
      notify(`Could not copy the ${subject.toLowerCase()} link`, "error");
    }
  };
}
