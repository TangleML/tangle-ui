import useToastNotification from "@/hooks/useToastNotification";

import { ActionButton } from "./ActionButton";

interface LinkNodeButtonProps {
  nodeId: string;
}

export const LinkNodeButton = ({ nodeId }: LinkNodeButtonProps) => {
  const notify = useToastNotification();

  const handleLink = () => {
    const link = new URL(window.location.href);
    link.searchParams.set("nodeId", nodeId);
    navigator.clipboard.writeText(link.toString());

    notify(`Link copied to clipboard`, "success");
  };

  return (
    <ActionButton tooltip="Shareable Link" icon="Link" onClick={handleLink} />
  );
};
