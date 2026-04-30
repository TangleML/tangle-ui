import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { flexNodeVariants, type FlexNodeViewProps } from "./FlexNode";

const PERCEIVED_FONT_SIZE = "28px";
const s = "var(--simplified-scale, 1)";

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
          <p
            className="font-semibold whitespace-pre-wrap line-clamp-3 wrap-break-word w-full leading-tight"
            style={{
              fontSize: `calc(${s} * ${PERCEIVED_FONT_SIZE})`,
              lineHeight: 1.25,
            }}
          >
            {title}
          </p>
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
