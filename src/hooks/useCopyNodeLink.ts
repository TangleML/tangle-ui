import useToastNotification from "@/hooks/useToastNotification";

export function useCopyNodeLink(nodeId: string) {
  const notify = useToastNotification();

  return () => {
    const link = new URL(window.location.href);
    link.searchParams.set("nodeId", nodeId);
    navigator.clipboard.writeText(link.toString()).then(
      () => notify("Link copied to clipboard", "success"),
      (err) => notify("Failed to copy link: " + err, "error"),
    );
  };
}
