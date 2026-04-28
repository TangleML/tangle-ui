import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { flexNodeVariants, type FlexNodeViewProps } from "./FlexNode";

export function FlexNodeSimplified({
  id,
  title,
  color,
  borderColor,
  locked,
  readOnly,
  selected,
  isTransparent,
  isBorderTransparent,
  hasContent,
  onNodeClick,
}: FlexNodeViewProps) {
  const node = (
    <div
      key={id}
      className={flexNodeVariants({
        readOnlySelected: !!(readOnly && selected),
        locked,
        transparent: isTransparent,
        hasContent,
        borderTransparent: isBorderTransparent,
      })}
      style={{
        backgroundColor: color,
        borderColor: isTransparent ? borderColor : undefined,
      }}
      onClick={onNodeClick}
    >
      <div
        className={cn(
          "rounded-sm h-full w-full p-2 overflow-hidden flex items-start",
          isTransparent ? "bg-transparent" : "bg-white/40",
        )}
      >
        {title && (
          <Paragraph
            weight="semibold"
            className="whitespace-pre-wrap line-clamp-3 wrap-break-word w-full text-[calc(var(--simplified-scale,1)*24px)] leading-tight"
          >
            {title}
          </Paragraph>
        )}
      </div>
    </div>
  );

  if (!title) return node;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{node}</TooltipTrigger>
      <TooltipContent side="top">{title}</TooltipContent>
    </Tooltip>
  );
}
