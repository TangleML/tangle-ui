import useToastNotification from "@/hooks/useToastNotification";
import { taskIdToNodeId } from "@/utils/nodes/nodeIdUtils";

import { ActionButton } from "../../Buttons/ActionButton";

interface LinkTaskButtonProps {
  taskId: string;
}

export const LinkTaskButton = ({ taskId }: LinkTaskButtonProps) => {
  const notify = useToastNotification();

  const handleLink = () => {
    const nodeId = taskIdToNodeId(taskId);
    const link = new URL(window.location.href);
    link.searchParams.set("nodeId", nodeId);
    navigator.clipboard.writeText(link.toString());

    notify(`Link copied to clipboard`, "success");
  };

  return (
    <ActionButton tooltip="Shareable Link" icon="Link" onClick={handleLink} />
  );
};
