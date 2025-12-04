import type { GetContainerExecutionStateResponse } from "@/api/types.gen";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useBackend } from "@/providers/BackendProvider";
import { useFetchContainerExecutionState } from "@/services/executionService";
import {
  type ComponentSpec,
  isGraphImplementation,
} from "@/utils/componentSpec";
import { EXIT_CODE_OOM } from "@/utils/constants";
import { formatDate, formatDuration } from "@/utils/date";

import { ContentBlock } from "../ContextPanel/Blocks/ContentBlock";
import type { KeyValuePairProps } from "../ContextPanel/Blocks/KeyValuePair";
import { ListBlock } from "../ContextPanel/Blocks/ListBlock";
import { InfoBox } from "../InfoBox";

interface ExecutionDetailsProps {
  executionId: string;
  componentSpec?: ComponentSpec;
  className?: string;
}

export const ExecutionDetails = ({
  executionId,
  componentSpec,
  className,
}: ExecutionDetailsProps) => {
  const { backendUrl } = useBackend();

  const isSubgraph =
    componentSpec && isGraphImplementation(componentSpec.implementation);

  const {
    data: containerState,
    isLoading: isLoadingContainerState,
    error: containerStateError,
  } = useFetchContainerExecutionState(executionId, backendUrl);

  const loadingMarkup = (
    <BlockStack gap="2">
      <InlineStack gap="2" blockAlign="center">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-32" />
      </InlineStack>
      <InlineStack gap="2" blockAlign="center">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-40" />
      </InlineStack>
    </BlockStack>
  );

  const getExecutionItems = () => {
    const items: KeyValuePairProps[] = [
      { label: "Execution ID", value: executionId },
    ];

    if (isSubgraph) {
      return items;
    }

    if (containerState?.exit_code && containerState.exit_code > 0) {
      const exitCodeValue =
        containerState.exit_code === EXIT_CODE_OOM
          ? `${containerState.exit_code} (Out of Memory)`
          : `${containerState.exit_code}`;

      items.push({
        label: "Exit Code",
        value: exitCodeValue,
        critical: true,
      });
    }

    if (containerState?.started_at) {
      items.push({
        label: "Started",
        value: formatDate(containerState.started_at),
      });
    }

    if (containerState?.ended_at && containerState?.started_at) {
      items.push({
        label: "Completed in",
        value: `${formatDuration(
          containerState.started_at,
          containerState.ended_at,
        )} (${formatDate(containerState.ended_at)})`,
      });
    }

    const podName = executionPodName(containerState);
    if (podName) {
      items.push({ label: "Pod Name", value: podName });
    }

    const executionJobLinks = getExecutionJobLinks(containerState);
    if (executionJobLinks) {
      executionJobLinks.forEach((linkInfo) => {
        if (!linkInfo.url) {
          return;
        }

        items.push({
          label: linkInfo.name,
          value: { text: linkInfo.value, href: linkInfo.url },
        });
      });
    }

    return items;
  };

  const executionItems = getExecutionItems();

  return (
    <ContentBlock
      title="Execution Details"
      collapsible
      defaultOpen
      className={className}
    >
      <BlockStack gap="2">
        <ListBlock items={executionItems} marker="none" />

        {!isSubgraph && isLoadingContainerState && loadingMarkup}

        {!isSubgraph && containerStateError && (
          <InfoBox
            title="Failed to load container state"
            variant="error"
            className="wrap-anywhere"
          >
            {containerStateError.message}
          </InfoBox>
        )}
      </BlockStack>
    </ContentBlock>
  );
};

function executionPodName(
  containerState?: GetContainerExecutionStateResponse,
): string | null {
  if (!containerState || !("debug_info" in containerState)) {
    return null;
  }

  const debugInfo = containerState.debug_info as Record<string, any>;

  if ("pod_name" in debugInfo && typeof debugInfo.pod_name === "string") {
    return debugInfo.pod_name;
  }

  if (
    "kubernetes" in debugInfo &&
    debugInfo.kubernetes &&
    typeof debugInfo.kubernetes === "object" &&
    "pod_name" in debugInfo.kubernetes &&
    typeof debugInfo.kubernetes.pod_name === "string"
  ) {
    return debugInfo.kubernetes.pod_name;
  }

  return null;
}

interface ExecutionLinkItem {
  name: string;
  value: string;
  url?: string;
}

function getExecutionJobLinks(
  containerState?: GetContainerExecutionStateResponse,
): Array<ExecutionLinkItem> | null {
  if (!containerState || !("debug_info" in containerState)) {
    return null;
  }

  const debugInfo = containerState.debug_info as Record<string, any>;

  const result = Array<ExecutionLinkItem>();

  const huggingfaceJob = debugInfo.huggingface_job as Record<string, any>;
  if (
    huggingfaceJob &&
    typeof huggingfaceJob === "object" &&
    typeof huggingfaceJob.id === "string" &&
    typeof huggingfaceJob.namespace === "string"
  ) {
    const url = `https://huggingface.co/jobs/${huggingfaceJob.namespace}/${huggingfaceJob.id}`;
    result.push({
      name: "HuggingFace Job",
      value: huggingfaceJob.id,
      url: url,
    });
  }

  return result;
}
