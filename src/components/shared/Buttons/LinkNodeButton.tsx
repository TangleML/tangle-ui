import { type ComponentPropsWithoutRef } from "react";

import useToastNotification from "@/hooks/useToastNotification";

import { ActionButton } from "./ActionButton";

type LinkNodeButtonProps = {
  nodeId: string;
} & Omit<
  ComponentPropsWithoutRef<typeof ActionButton>,
  "onClick" | "tooltip" | "icon" | "children"
>;

export const LinkNodeButton = ({ nodeId, ...rest }: LinkNodeButtonProps) => {
  const notify = useToastNotification();

  const handleLink = () => {
    const link = new URL(window.location.href);
    link.searchParams.set("nodeId", nodeId);
    navigator.clipboard.writeText(link.toString());

    notify(`Link copied to clipboard`, "success");
  };

  return (
    <ActionButton
      tooltip="Shareable Link"
      icon="Link"
      onClick={handleLink}
      {...rest}
    />
  );
};
