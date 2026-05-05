import type { ComponentProps } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";

import { trimDigest } from "./utils/digest";

export const TrimmedDigest = ({
  digest,
  tooltip = true,
  ...props
}: {
  digest: string;
  tooltip?: boolean;
} & ComponentProps<typeof Text>) => {
  if (!tooltip) {
    return (
      <Text size="xs" font="mono" {...props}>
        {trimDigest(digest)}
      </Text>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Text size="xs" font="mono" {...props}>
          {trimDigest(digest)}
        </Text>
      </TooltipTrigger>
      <TooltipContent>
        <span>{digest}</span>
      </TooltipContent>
    </Tooltip>
  );
};
