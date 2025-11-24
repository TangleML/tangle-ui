import { ChevronsUpDown } from "lucide-react";

import type { ArtifactDataResponse } from "@/api/types.gen";
import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  InputSpec,
  OutputSpec,
  TypeSpecType,
} from "@/utils/componentSpec";
import { formatBytes } from "@/utils/string";
import { convertArtifactUriToHTTPUrl } from "@/utils/URL";

import type { IOCellActions, IOCellCopyState } from "./IOCell";

interface IOCellHeaderProps {
  io: InputSpec | OutputSpec;
  artifactData: ArtifactDataResponse | null | undefined;
  copyState: IOCellCopyState;
  actions: IOCellActions;
  isOpen?: boolean;
}

const IOCellHeader = ({
  io,
  artifactData,
  copyState,
  actions,
  isOpen = false,
}: IOCellHeaderProps) => {
  const { isCopied, isTooltipOpen, copyType } = copyState;
  const { handleCopyName, handleTooltipOpen } = actions;

  const hasCollapsableContent = !canShowInlineValue(
    artifactData?.value,
    io.type,
  );

  return (
    <BlockStack
      gap="3"
      className={cn(
        "py-3 border bg-white",
        isOpen && hasCollapsableContent
          ? "rounded-t-md border-b-0"
          : "rounded-md",
      )}
    >
      <InlineStack
        align="space-between"
        blockAlign="center"
        gap="2"
        className="px-3 w-full"
      >
        <div className="flex-1 min-w-auto shrink-0">
          <Tooltip
            delayDuration={300}
            open={isTooltipOpen}
            onOpenChange={handleTooltipOpen}
          >
            <TooltipTrigger className="text-left">
              <span
                className="font-medium text-sm cursor-copy hover:text-gray-500"
                onClick={handleCopyName}
              >
                {io.name}
              </span>
            </TooltipTrigger>
            <TooltipContent
              arrowClassName={cn(isCopied && "bg-emerald-200 fill-emerald-200")}
              className={cn(isCopied && "bg-emerald-200 text-emerald-800")}
            >
              {isCopied ? `${copyType} copied` : `Copy`}
            </TooltipContent>
          </Tooltip>
        </div>

        {artifactData && (
          <InlineStack gap="2">
            <InlineStack
              blockAlign="center"
              gap="1"
              className="text-xs text-gray-500"
            >
              {artifactData.uri && (
                <>
                  <Link
                    href={convertArtifactUriToHTTPUrl(
                      artifactData.uri || "",
                      artifactData.is_dir || false,
                    )}
                    external
                    iconClassName="h-2.5 w-2.5"
                    className="font-mono break-all text-[10px] text-blue-600 hover:text-blue-800 hover:underline flex gap-1"
                  >
                    Link
                  </Link>
                  &bull;
                </>
              )}

              {artifactData.value &&
                canShowInlineValue(artifactData.value, io.type) && (
                  <>
                    <span className="font-mono text-[10px] text-amber-500">
                      {artifactData.value}
                    </span>
                    &bull;
                  </>
                )}

              <span className="font-mono text-[10px] text-gray-500">
                {formatBytes(artifactData.total_size)} &bull;
              </span>

              {io.type?.toString()}

              <CollapsibleTrigger
                disabled={!hasCollapsableContent}
                className={cn({
                  hidden: !hasCollapsableContent,
                })}
              >
                <ChevronsUpDown className="w-4 h-4 cursor-pointer" />
              </CollapsibleTrigger>
            </InlineStack>
          </InlineStack>
        )}
      </InlineStack>
    </BlockStack>
  );
};

export default IOCellHeader;

const canShowInlineValue = (
  value: string | null | undefined,
  type: TypeSpecType | undefined,
) => {
  if (!type || !value) {
    return false;
  }
  if (type === "Integer" || type === "Boolean") {
    return true;
  }
  if (type === "String" && value.length < 31) {
    return true;
  }
  return false;
};
