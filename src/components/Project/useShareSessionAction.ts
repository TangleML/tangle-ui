import useToastNotification from "@/hooks/useToastNotification";
import { copyToClipboard } from "@/utils/string";
import { getTangentSessionUrl } from "@/utils/URL";

export function useShareSessionAction(
  projectId: string,
): (sessionId: string) => void {
  const notify = useToastNotification();

  return (sessionId) => {
    copyToClipboard(getTangentSessionUrl(projectId, sessionId));
    notify("Session URL copied to clipboard", "success");
  };
}
