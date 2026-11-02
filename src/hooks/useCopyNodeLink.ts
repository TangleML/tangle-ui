import useToastNotification from "@/hooks/useToastNotification";

export function useCopyNodeLink(nodeId: string) {
  const notify = useToastNotification();

  return () => {
    const link = new URL(window.location.href);
    link.searchParams.set("nodeId", nodeId);
    navigator.clipboard.writeText(link.toString());

    notify("Link copied to clipboard", "success");
  };
}
