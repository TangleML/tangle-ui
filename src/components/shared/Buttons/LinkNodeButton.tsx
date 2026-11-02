import { type ComponentPropsWithoutRef } from "react";

import { useCopyNodeLink } from "@/hooks/useCopyNodeLink";

import { ActionButton } from "./ActionButton";

type LinkNodeButtonProps = {
  nodeId: string;
} & Omit<
  ComponentPropsWithoutRef<typeof ActionButton>,
  "onClick" | "tooltip" | "icon" | "children"
>;

export const LinkNodeButton = ({ nodeId, ...rest }: LinkNodeButtonProps) => {
  const handleLink = useCopyNodeLink(nodeId);

  return (
    <ActionButton
      tooltip="Shareable Link"
      icon="Link"
      onClick={handleLink}
      {...rest}
    />
  );
};
