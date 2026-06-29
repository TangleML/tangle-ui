import type { ComponentProps, DragEvent } from "react";
import { useCallback, useMemo, useRef } from "react";

import { ComponentDetailsDialog } from "@/components/shared/Dialogs";
import { ComponentFavoriteToggle } from "@/components/shared/FavoriteComponentToggle";
import { useOutdatedComponents } from "@/components/shared/ManageComponent/hooks/useOutdatedComponents";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import { cn } from "@/lib/utils";
import {
  formatComponentSearchMatchSummary,
  formatMatchedFieldsExplanation,
} from "@/services/componentSearchExplanations";
import type {
  ComponentSearchSource,
  MatchField,
} from "@/services/componentSearchIndex";
import { type ComponentReference, type TaskSpec } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";
import { isSubgraph } from "@/utils/subgraphUtils";

import { useNodesOverlay } from "../../NodesOverlay/NodesOverlayProvider";
import {
  ComponentHoverPopover,
  type ComponentHoverPopoverHandle,
} from "./ComponentHoverPopover";

interface ComponentMarkupProps {
  component: ComponentReference;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
  matchedFields?: MatchField[];
  rerankScore?: number;
  rerankReason?: string;
  source?: ComponentSearchSource;
}

type ComponentIconProps = {
  component: ComponentReference;
} & ComponentProps<typeof Icon>;

const ComponentIconSkeleton = ({
  ...iconProps
}: Partial<ComponentIconProps>) => {
  return <Icon name="File" className="shrink-0 text-gray-400" {...iconProps} />;
};

function hasProps(props: any): props is ComponentIconProps {
  return (
    props !== undefined &&
    props !== null &&
    typeof props === "object" &&
    "name" in props &&
    "className" in props
  );
}

const ComponentIcon = withSuspenseWrapper(
  ({ component, className, ...iconProps }: ComponentIconProps) => {
    const { data: outdatedComponents } = useOutdatedComponents([component]);

    const hasOutdatedComponents = outdatedComponents.length > 0;

    if (!hasOutdatedComponents)
      return <Icon className={className} {...iconProps} />;

    return <Icon name="BookAlert" className="text-orange-500" />;
  },
  ComponentIconSkeleton,
  /**
   * Error fallback to show just the icon
   */
  ({ originalProps }) =>
    hasProps(originalProps) ? (
      <Icon name={originalProps.name} className={originalProps.className} />
    ) : (
      <Icon name="File" className="shrink-0 text-gray-400" />
    ),
);

function rerankScoreClass(score: number): string {
  if (score >= 0.9) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 0.75)
    return "text-emerald-600 bg-emerald-50/70 border-emerald-100";
  return "text-emerald-500 bg-white border-emerald-100";
}

const ComponentMarkup = ({
  component,
  isLoading,
  error,
  className,
  matchedFields,
  rerankScore,
  rerankReason,
  source,
}: ComponentMarkupProps) => {
  const isRemoteComponentLibrarySearchEnabled = useFlagValue(
    "remote-component-library-search",
  );

  const popoverRef = useRef<ComponentHoverPopoverHandle>(null);

  // TODO: respect selected node as a starting point
  const carousel = useRef(0);
  const { notifyNode, getNodeIdsByDigest, fitNodeIntoView } = useNodesOverlay();

  const {
    spec,
    digest,
    url,
    name,
    owned,
    published_by: publishedBy,
  } = component;
  const componentIdentifier = publishedBy
    ? `Published by ${publishedBy}`
    : digest
      ? `Digest ${digest}`
      : undefined;

  const displayName = useMemo(
    () => name ?? getComponentName({ spec, url }),
    [spec, url, name],
  );

  const isSubgraphSpec = isSubgraph(spec);

  const onDragStart = useCallback(
    (event: DragEvent) => {
      const taskSpec: TaskSpec = {
        componentRef: component,
      };

      event.dataTransfer.setData(
        "application/reactflow",
        JSON.stringify({ task: taskSpec }),
      );

      event.dataTransfer.setData(
        "DragStart.offset",
        JSON.stringify({
          offsetX: event.nativeEvent.offsetX,
          offsetY: event.nativeEvent.offsetY,
        }),
      );

      event.dataTransfer.effectAllowed = "move";
    },
    [component],
  );

  const onMouseEnter = useCallback(() => {
    if (!digest) return;

    const nodeIds = getNodeIdsByDigest(digest);
    nodeIds.forEach((nodeId) => {
      notifyNode(nodeId, {
        type: "highlight",
      });
    });
  }, [digest]);

  const onMouseLeave = useCallback(() => {
    if (!digest) return;

    const nodeIds = getNodeIdsByDigest(digest);
    nodeIds.forEach((nodeId) => {
      notifyNode(nodeId, {
        type: "clear",
      });
    });
  }, [digest]);

  const onMouseClick = useCallback(() => {
    if (!digest) return;

    const nodeIds = getNodeIdsByDigest(digest);

    const idx = carousel.current % nodeIds.length;
    carousel.current = carousel.current + 1;

    fitNodeIntoView(nodeIds[idx]);
  }, [digest, getNodeIdsByDigest, fitNodeIntoView]);

  const onComponentDetailsDialogOpenChange = useCallback((open: boolean) => {
    if (open) {
      popoverRef.current?.close();
    }
  }, []);

  const iconName = isSubgraphSpec ? "Workflow" : "Package";
  const matchExplanation = formatComponentSearchMatchSummary(
    rerankReason ?? formatMatchedFieldsExplanation(matchedFields),
  );

  const iconClass = cn(
    "shrink-0",
    isSubgraphSpec
      ? "text-violet-500"
      : source?.kind === "published"
        ? "text-emerald-500"
        : source?.kind === "registered"
          ? "text-teal-500"
          : source?.kind === "user" || owned
            ? "text-orange-500"
            : "text-blue-500",
  );

  return (
    <li
      className={cn(
        "group w-full px-3 py-2 text-left transition-colors",
        error
          ? "cursor-not-allowed opacity-60"
          : "cursor-grab hover:bg-muted/40 active:bg-muted/60",
        className,
      )}
      draggable={!error && !isLoading}
      onDragStart={onDragStart}
    >
      <InlineStack gap="2" wrap="nowrap" className="w-full min-w-0">
        {isLoading ? (
          <span className="text-gray-400 truncate text-sm">Loading...</span>
        ) : error ? (
          <span className="truncate text-xs text-red-500">
            Error loading component
          </span>
        ) : (
          <InlineStack
            wrap="nowrap"
            gap="3"
            className="w-full"
            data-testid="component-item"
            data-component-name={displayName}
          >
            <InlineStack
              gap="2"
              className="flex-1 min-w-0"
              wrap="nowrap"
              blockAlign="start"
            >
              {isRemoteComponentLibrarySearchEnabled ? (
                <ComponentIcon
                  name={iconName}
                  className={iconClass}
                  component={component}
                  size="sm"
                />
              ) : (
                <Icon name={iconName} className={iconClass} size="sm" />
              )}

              <div
                className="flex flex-col flex-1 min-w-0 gap-1"
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onClick={onMouseClick}
              >
                <Text
                  size="sm"
                  weight="semibold"
                  className="min-w-0 truncate"
                  title={displayName}
                >
                  {displayName}
                </Text>
                {componentIdentifier && (
                  <Text
                    size="xs"
                    tone="subdued"
                    className="min-w-0 truncate"
                    title={componentIdentifier}
                  >
                    {componentIdentifier}
                  </Text>
                )}
                {matchExplanation && (
                  <Text
                    size="xs"
                    tone="subdued"
                    className="min-w-0 line-clamp-1"
                    title={matchExplanation}
                  >
                    Why: {matchExplanation}
                  </Text>
                )}
              </div>
            </InlineStack>

            <InlineStack
              align="end"
              blockAlign="center"
              gap="1"
              wrap="nowrap"
              className="shrink-0 self-center opacity-70 transition-opacity group-hover:opacity-100"
            >
              {rerankScore !== undefined && (
                <Text
                  size="xs"
                  weight="semibold"
                  className={cn(
                    "shrink-0 rounded-full border px-1.5 py-0.5 leading-none",
                    rerankScoreClass(rerankScore),
                  )}
                  title={`${Math.round(rerankScore * 100)}% likely to match your search`}
                  aria-label={`${Math.round(rerankScore * 100)} percent likely to match your search`}
                >
                  {Math.round(rerankScore * 100)}%
                </Text>
              )}
              <ComponentFavoriteToggle component={component} />

              <ComponentHoverPopover ref={popoverRef} component={component}>
                <InlineStack>
                  <ComponentDetailsDialog
                    displayName={displayName}
                    component={component}
                    onOpenChange={onComponentDetailsDialogOpenChange}
                  />
                </InlineStack>
              </ComponentHoverPopover>
            </InlineStack>
          </InlineStack>
        )}
      </InlineStack>
    </li>
  );
};

const ComponentItemSkeleton = () => {
  return (
    <li className="pl-2 py-1.5">
      <InlineStack gap="2">
        <Spinner size={10} />
        <Skeleton size="sm" color="default" />
      </InlineStack>
    </li>
  );
};

const ComponentItemFromUrl = withSuspenseWrapper(
  ({ componentRef }: { componentRef: ComponentReference }) => {
    const hydratedComponent = useHydrateComponentReference(componentRef);

    if (!hydratedComponent) return null;

    return <ComponentMarkup component={hydratedComponent} />;
  },
  ComponentItemSkeleton,
  () => null,
);

interface IONodeSidebarItemProps {
  nodeType: "input" | "output";
}

export const IONodeSidebarItem = ({ nodeType }: IONodeSidebarItemProps) => {
  const onDragStart = useCallback(
    (event: DragEvent) => {
      event.dataTransfer.setData(
        "application/reactflow",
        JSON.stringify({ [nodeType]: null }),
      );
      event.dataTransfer.setData(
        "DragStart.offset",
        JSON.stringify({
          offsetX: event.nativeEvent.offsetX,
          offsetY: event.nativeEvent.offsetY,
        }),
      );
      event.dataTransfer.effectAllowed = "move";
    },
    [nodeType],
  );

  return (
    <li
      className={cn(
        "pl-2 py-1.5 cursor-grab hover:bg-gray-100 active:bg-gray-200",
      )}
      draggable
      onDragStart={onDragStart}
    >
      <div className="flex items-center gap-2">
        <Icon name="File" className="text-gray-400 shrink-0" />
        <span className="truncate text-xs text-gray-800">
          {nodeType === "input" ? "Input Node" : "Output Node"}
        </span>
      </div>
    </li>
  );
};

export const StickyNoteSidebarItem = () => {
  const onDragStart = useCallback((event: DragEvent) => {
    event.dataTransfer.setData(
      "application/reactflow",
      JSON.stringify({ ["flex"]: null }),
    );
    event.dataTransfer.setData(
      "DragStart.offset",
      JSON.stringify({
        offsetX: event.nativeEvent.offsetX,
        offsetY: event.nativeEvent.offsetY,
      }),
    );
    event.dataTransfer.effectAllowed = "move";
  }, []);

  return (
    <li
      className="pl-2 py-1.5 cursor-grab hover:bg-gray-100 active:bg-gray-200"
      data-testid="sticky-note-sidebar-item"
      draggable
      onDragStart={onDragStart}
    >
      <InlineStack blockAlign="center" gap="2">
        <Icon name="StickyNote" className="text-gray-400 shrink-0" />
        <Text size="sm" className="truncate">
          Sticky Note
        </Text>
      </InlineStack>
    </li>
  );
};

export { ComponentItemFromUrl, ComponentMarkup };
