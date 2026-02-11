import type { ComponentProps, DragEvent } from "react";
import { useCallback, useMemo, useRef } from "react";

import { ComponentDetailsDialog } from "@/components/shared/Dialogs";
import { ComponentFavoriteToggle } from "@/components/shared/FavoriteComponentToggle";
import { useOutdatedComponents } from "@/components/shared/ManageComponent/hooks/useOutdatedComponents";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import { cn } from "@/lib/utils";
import { type ComponentReference, type TaskSpec } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";
import { isSubgraph } from "@/utils/subgraphUtils";

import { useNodesOverlay } from "../../NodesOverlay/NodesOverlayProvider";

interface ComponentMarkupProps {
  component: ComponentReference;
  isLoading?: boolean;
  error?: string | null;
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

const ComponentMarkup = ({
  component,
  isLoading,
  error,
}: ComponentMarkupProps) => {
  const isHighlightTasksOnComponentHoverEnabled = useFlagValue(
    "highlight-node-on-component-hover",
  );
  const isRemoteComponentLibrarySearchEnabled = useFlagValue(
    "remote-component-library-search",
  );

  // TODO: respect selected node as a starting point
  const carousel = useRef(0);
  const { notifyNode, getNodeIdsByDigest, fitNodeIntoView } = useNodesOverlay();

  const { spec, digest, url, name, published_by: author, owned } = component;

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
    if (!isHighlightTasksOnComponentHoverEnabled) return;

    if (!digest) return;

    const nodeIds = getNodeIdsByDigest(digest);
    nodeIds.forEach((nodeId) => {
      notifyNode(nodeId, {
        type: "highlight",
      });
    });
  }, [digest, isHighlightTasksOnComponentHoverEnabled]);

  const onMouseLeave = useCallback(() => {
    if (!isHighlightTasksOnComponentHoverEnabled) return;

    if (!digest) return;

    const nodeIds = getNodeIdsByDigest(digest);
    nodeIds.forEach((nodeId) => {
      notifyNode(nodeId, {
        type: "clear",
      });
    });
  }, [digest, isHighlightTasksOnComponentHoverEnabled]);

  const onMouseClick = useCallback(() => {
    if (!isHighlightTasksOnComponentHoverEnabled) return;

    if (!digest) return;

    const nodeIds = getNodeIdsByDigest(digest);

    const idx = carousel.current % nodeIds.length;
    carousel.current = carousel.current + 1;

    fitNodeIntoView(nodeIds[idx]);
  }, [
    digest,
    getNodeIdsByDigest,
    fitNodeIntoView,
    isHighlightTasksOnComponentHoverEnabled,
  ]);

  const iconName = isSubgraphSpec ? "Workflow" : owned ? "FileBadge" : "File";

  const iconClass = cn(
    "shrink-0",
    isSubgraphSpec ? "text-blue-400" : "text-gray-400",
  );

  return (
    <SidebarMenuItem
      className={cn(
        "pl-2 py-1.5",
        error
          ? "cursor-not-allowed opacity-60"
          : "cursor-grab hover:bg-gray-100 active:bg-gray-200",
      )}
      draggable={!error && !isLoading}
      onDragStart={onDragStart}
    >
      <InlineStack gap="2">
        {isLoading ? (
          <span className="text-gray-400 truncate text-sm">Loading...</span>
        ) : error ? (
          <span className="truncate text-xs text-red-500">
            Error loading component
          </span>
        ) : (
          <InlineStack
            wrap="nowrap"
            data-testid="component-item"
            data-component-name={displayName}
          >
            <InlineStack gap="2" className="w-full" wrap="nowrap">
              {isRemoteComponentLibrarySearchEnabled ? (
                <ComponentIcon
                  name={iconName}
                  className={iconClass}
                  component={component}
                />
              ) : (
                <Icon name={iconName} className={iconClass} />
              )}

              <div
                className="flex flex-col w-32"
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onClick={onMouseClick}
              >
                <span
                  className="truncate text-xs text-gray-800"
                  title={displayName}
                >
                  {displayName}
                </span>
                {author && author.length > 0 && (
                  <span className="truncate text-[10px] text-gray-500 max-w-[100px] font-mono">
                    {author}
                  </span>
                )}
                <span className="truncate text-[10px] text-gray-500 max-w-[100px] font-mono">
                  Ver: {digest}
                </span>
              </div>
            </InlineStack>
            <InlineStack align="end" wrap="nowrap">
              <ComponentFavoriteToggle component={component} />
              <ComponentDetailsDialog
                displayName={displayName}
                component={component}
              />
            </InlineStack>
          </InlineStack>
        )}
      </InlineStack>
    </SidebarMenuItem>
  );
};

const ComponentItemSkeleton = () => {
  return (
    <SidebarMenuItem className="pl-2 py-1.5">
      <InlineStack gap="2">
        <Spinner size={10} />
        <Skeleton size="sm" color="default" />
      </InlineStack>
    </SidebarMenuItem>
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
    <SidebarMenuItem
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
    </SidebarMenuItem>
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
    <SidebarMenuItem
      className="pl-2 py-1.5 cursor-grab hover:bg-gray-100 active:bg-gray-200"
      draggable
      onDragStart={onDragStart}
    >
      <div className="flex items-center gap-2">
        <Icon name="StickyNote" className="text-gray-400 shrink-0" />
        <span className="truncate text-xs text-gray-800">Sticky Note</span>
      </div>
    </SidebarMenuItem>
  );
};

export { ComponentItemFromUrl, ComponentMarkup };
