import {
  ChevronsUpDown,
  ClipboardIcon,
  DownloadIcon,
  ExternalLink,
  TrashIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { FaPython } from "react-icons/fa";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCopyToClipboard } from "@/hooks/useCopyToClip";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import type { ComponentSpec } from "@/utils/componentSpec";
import {
  convertGithubUrlToDirectoryUrl,
  downloadYamlFromComponentText,
  isGithubUrl,
} from "@/utils/URL";
import copyToYaml from "@/utils/yaml";

import { ExecutionDetails } from "../ExecutionDetails/ExecutionDetails";

interface TaskDetailsProps {
  displayName: string;
  componentSpec: ComponentSpec;
  executionId?: string;
  taskId?: string;
  componentDigest?: string;
  url?: string;
  actions?: ReactNode[];
  onDelete?: () => void;
  hasDeletionConfirmation?: boolean;
  status?: string;
  readOnly?: boolean;
  additionalSection?: {
    title: string;
    component: ReactNode;
    isCollapsed?: boolean;
  }[];
}

const TaskDetails = ({
  displayName,
  componentSpec,
  executionId,
  taskId,
  componentDigest,
  url,
  actions = [],
  onDelete,
  hasDeletionConfirmation = true,
  status,
  readOnly = false,
  additionalSection = [],
}: TaskDetailsProps) => {
  const notify = useToastNotification();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { isCopied, isTooltipOpen, handleCopy, handleTooltipOpen } =
    useCopyToClipboard(componentDigest);

  const canonicalUrl = componentSpec?.metadata?.annotations?.canonical_location;
  const pythonOriginalCode = (componentSpec?.metadata?.annotations
    ?.original_python_code ||
    componentSpec?.metadata?.annotations?.python_original_code) as
    | string
    | undefined;

  let reconstructedUrl;
  if (!url) {
    // Try reconstruct the url from componentSpec.metadata.annotations
    const annotations = componentSpec?.metadata?.annotations || {};
    const {
      git_remote_url,
      git_remote_branch,
      git_relative_dir,
      component_yaml_path,
    } = annotations;

    if (
      git_remote_url &&
      git_remote_branch &&
      git_relative_dir &&
      component_yaml_path
    ) {
      reconstructedUrl = `https://github.com/${(git_remote_url as string)
        .replace(/^https:\/\/github\.com\//, "")
        .replace(
          /\.git$/,
          "",
        )}/blob/${git_remote_branch}/${git_relative_dir}/${component_yaml_path}`;
    }
  }

  const stringToPythonCodeDownload = () => {
    if (!pythonOriginalCode) return;

    const blob = new Blob([pythonOriginalCode], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${componentSpec?.name || displayName}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadYaml = () => {
    downloadYamlFromComponentText(componentSpec, displayName);
  };

  const handleCopyYaml = () => {
    copyToYaml(
      componentSpec,
      (message) => notify(message, "success"),
      (message) => notify(message, "error"),
    );
  };

  const handleDelete = useCallback(() => {
    if (confirmDelete || !hasDeletionConfirmation) {
      try {
        onDelete?.();
      } catch (error) {
        console.error("Error deleting component:", error);
      }
    } else if (hasDeletionConfirmation) {
      setConfirmDelete(true);
    }
  }, [onDelete, confirmDelete, hasDeletionConfirmation]);

  return (
    <div className="h-full overflow-auto hide-scrollbar">
      <div className="border rounded-md divide-y w-full h-full">
        {taskId && (
          <div className="flex flex-col px-3 py-2">
            <div className="flex-shrink-0 font-medium text-sm text-gray-700 mb-1">
              Task ID
            </div>
            <div className="text-xs text-gray-600 break-words whitespace-pre-wrap">
              {taskId}
            </div>
          </div>
        )}
        {status && (
          <div className="flex flex-col px-3 py-2">
            <div className="flex-shrink-0 font-medium text-sm text-gray-700 mb-1">
              Run Status
            </div>
            <div className="text-xs text-gray-600 break-words whitespace-pre-wrap">
              {status}
            </div>
          </div>
        )}

        {executionId && (
          <ExecutionDetails
            executionId={executionId}
            componentSpec={componentSpec}
          />
        )}

        {componentSpec?.metadata?.annotations?.author && (
          <div className="flex flex-col px-3 py-2">
            <div className="flex-shrink-0 font-medium text-sm text-gray-700 mb-1">
              Author
            </div>
            <div className="text-xs text-gray-600 break-words whitespace-pre-wrap">
              {componentSpec.metadata.annotations?.author}
            </div>
          </div>
        )}

        <LinkBlock
          url={url && url.length > 0 ? url : reconstructedUrl}
          canonicalUrl={canonicalUrl}
        />

        {componentSpec?.description && (
          <div className="flex flex-col px-3 py-2">
            <Collapsible>
              <div className="font-medium text-sm text-gray-700 flex items-center gap-1">
                Description
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronsUpDown className="h-4 w-4" />
                    <span className="sr-only">Toggle</span>
                  </Button>
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent className="mt-1">
                <div className="text-xs text-gray-600 break-words whitespace-pre-wrap">
                  {componentSpec.description}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {componentDigest && (
          <div className="flex flex-col px-3 py-2">
            <div className="flex-shrink-0 font-medium text-sm text-gray-700 mb-1">
              Digest
            </div>
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={handleCopy}
            >
              <span className="font-mono text-xs truncate">
                {componentDigest}
              </span>
              <Tooltip
                delayDuration={300}
                open={isTooltipOpen}
                onOpenChange={handleTooltipOpen}
              >
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ClipboardIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  arrowClassName={cn(
                    isCopied && "bg-emerald-200 fill-emerald-200",
                  )}
                  className={cn(isCopied && "bg-emerald-200 text-emerald-800")}
                >
                  {isCopied ? "Copied" : "Copy Digest"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
        {additionalSection.map((section) => (
          <div className="flex flex-col px-3 py-2" key={section.title}>
            <Collapsible defaultOpen={!section.isCollapsed}>
              <CollapsibleTrigger asChild>
                <div className="font-medium text-sm text-gray-700 flex items-center gap-1">
                  {section.title}

                  <Button variant="ghost" size="sm">
                    <ChevronsUpDown className="h-4 w-4" />
                    <span className="sr-only">Toggle</span>
                  </Button>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-1 min-h-0 flex-1 h-full">
                {section.component}
              </CollapsibleContent>
            </Collapsible>
          </div>
        ))}

        <div className="px-3 py-2 flex flex-row gap-2" key={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" onClick={handleDownloadYaml}>
                <DownloadIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download YAML</TooltipContent>
          </Tooltip>
          {pythonOriginalCode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  onClick={stringToPythonCodeDownload}
                >
                  <FaPython className="mr-1" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download Python Code</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="secondary" onClick={handleCopyYaml}>
                <ClipboardIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy YAML</TooltipContent>
          </Tooltip>

          {actions}

          {onDelete && !readOnly && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="destructive" onClick={handleDelete}>
                  <div className="flex items-center gap-2">
                    <TrashIcon />
                    {confirmDelete && hasDeletionConfirmation && (
                      <span className="text-xs">Confirm Delete</span>
                    )}
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {confirmDelete || !hasDeletionConfirmation
                  ? "Confirm Delete. This action cannot be undone."
                  : "Delete Component"}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetails;

function LinkBlock({
  url,
  canonicalUrl,
}: {
  url?: string;
  canonicalUrl?: string;
}) {
  if (!url && !canonicalUrl) return null;

  return (
    <div className="flex flex-col px-3 py-2">
      <div className="flex-shrink-0 font-medium text-sm text-gray-700 mb-1">
        URL
      </div>
      {url && (
        <>
          <div className="text-sm break-all">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-500 hover:underline flex items-center gap-1"
            >
              View raw component.yaml
              <ExternalLink className="size-3 flex-shrink-0" />
            </a>
          </div>
          <div className="text-sm break-all">
            <a
              href={
                isGithubUrl(url) ? convertGithubUrlToDirectoryUrl(url) : url
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-500 hover:underline flex items-center gap-1"
            >
              View directory on GitHub
              <ExternalLink className="size-3 flex-shrink-0" />
            </a>
          </div>
        </>
      )}
      {canonicalUrl && (
        <>
          <div className="text-sm break-all">
            <a
              href={canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-500 hover:underline flex items-center gap-1"
            >
              View raw canonical URL
              <ExternalLink className="size-3 flex-shrink-0" />
            </a>
          </div>
          <div className="text-sm break-all">
            <a
              href={convertGithubUrlToDirectoryUrl(canonicalUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-500 hover:underline flex items-center gap-1"
            >
              View canonical URL on GitHub
              <ExternalLink className="size-3 flex-shrink-0" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}
