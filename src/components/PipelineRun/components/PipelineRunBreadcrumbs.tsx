import { useNavigate, useParams } from "@tanstack/react-router";
import { Check, ChevronRight, Copy, Network } from "lucide-react";
import { type MouseEvent, useCallback, useEffect, useState } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { loadPipelineByName } from "@/services/pipelineService";
import { copyToClipboard } from "@/utils/string";

interface PipelineRunBreadcrumbsProps {
  variant?: "overlay" | "topbar";
}

export const PipelineRunBreadcrumbs = ({
  variant = "overlay",
}: PipelineRunBreadcrumbsProps) => {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const { componentSpec } = useComponentSpec();
  const executionData = useExecutionDataOptional();

  // Get run ID from execution data OR from URL params (fallback for when provider isn't loaded yet)
  const runIdFromParams =
    "id" in params && typeof params.id === "string" ? params.id : undefined;
  const runId = executionData?.runId || runIdFromParams;
  const metadata = executionData?.metadata;
  const [isCopied, setIsCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [pipelineExistsLocally, setPipelineExistsLocally] = useState<
    boolean | null
  >(null);

  const pipelineName = componentSpec?.name || metadata?.pipeline_name;

  // Check if the pipeline exists in local storage
  useEffect(() => {
    const checkPipelineExists = async () => {
      if (!pipelineName) {
        setPipelineExistsLocally(null);
        return;
      }

      try {
        const result = await loadPipelineByName(pipelineName);
        setPipelineExistsLocally(!!result.experiment);
      } catch (error) {
        console.error("Error checking pipeline existence:", error);
        setPipelineExistsLocally(false);
      }
    };

    checkPipelineExists();
  }, [pipelineName]);

  const handleNavigateToPipeline = useCallback(() => {
    if (pipelineName && pipelineExistsLocally) {
      navigate({ to: `/editor/${encodeURIComponent(pipelineName)}` });
    }
  }, [pipelineName, pipelineExistsLocally, navigate]);

  const handleCopyRunId = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (runId) {
        copyToClipboard(runId);
        setIsCopied(true);
      }
    },
    [runId],
  );

  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  if (!pipelineName) {
    return null;
  }

  // Styles for topbar variant (white text on dark background)
  const isTopbar = variant === "topbar";
  const textColorClass = isTopbar ? "text-white" : "text-foreground";
  const mutedTextClass = isTopbar ? "text-gray-300" : "text-muted-foreground";
  const buttonVariantClass = isTopbar
    ? "h-7 px-2 gap-1.5 font-medium text-gray-300 hover:text-white hover:bg-stone-800"
    : "h-7 px-2 gap-1.5 text-muted-foreground hover:text-foreground font-medium";

  // Container for overlay variant
  const containerClass = isTopbar
    ? "flex items-center gap-1"
    : "absolute top-0 left-0 z-10 bg-white/95 backdrop-blur-sm shadow-md rounded-br-xl border-b border-r border-gray-200";

  return (
    <div className={containerClass}>
      <div className={isTopbar ? "" : "px-4 py-2.5"}>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {pipelineExistsLocally ? (
                <BreadcrumbLink asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNavigateToPipeline}
                    title="Navigate to pipeline in editor"
                    className={buttonVariantClass}
                  >
                    <Network className="w-4 h-4 rotate-270" />
                    {pipelineName}
                  </Button>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage
                  title={
                    pipelineExistsLocally === null
                      ? "Checking if pipeline exists locally..."
                      : "Pipeline not saved locally. Use 'Clone Pipeline' to edit."
                  }
                  className={cn(
                    "flex items-center gap-1.5 h-7 px-2",
                    mutedTextClass,
                  )}
                >
                  <Network className="w-4 h-4 rotate-270" />
                  {pipelineName}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className={cn("w-4 h-4", mutedTextClass)} />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              {runId ? (
                <div
                  className="group flex items-center gap-1 cursor-pointer"
                  onClick={handleCopyRunId}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  title={`Click to copy: ${runId}`}
                >
                  <span
                    className={cn(
                      "text-sm font-medium transition-colors duration-150",
                      isCopied ? "text-emerald-500" : textColorClass,
                    )}
                  >
                    Run {runId}
                  </span>
                  <span className="relative h-3.5 w-3.5">
                    <Check
                      className={cn(
                        "absolute inset-0 h-3.5 w-3.5 text-emerald-500 transition-all duration-200",
                        isCopied
                          ? "rotate-0 scale-100 opacity-100"
                          : "-rotate-90 scale-0 opacity-0",
                      )}
                    />
                    <Copy
                      className={cn(
                        "absolute inset-0 h-3.5 w-3.5 transition-all duration-200",
                        mutedTextClass,
                        isHovered && !isCopied
                          ? "rotate-0 scale-100 opacity-100"
                          : "rotate-90 scale-0 opacity-0",
                      )}
                    />
                  </span>
                </div>
              ) : (
                <span className={cn("text-sm font-medium", textColorClass)}>
                  Run
                </span>
              )}
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
};
