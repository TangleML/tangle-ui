import type { ComponentProps, DragEvent } from "react";
import { useCallback, useMemo, useRef } from "react";

import { ComponentDetailsDialog } from "@/components/shared/Dialogs";
import { ComponentFavoriteToggle } from "@/components/shared/FavoriteComponentToggle";
import { useOutdatedComponents } from "@/components/shared/ManageComponent/hooks/useOutdatedComponents";
import { useBetaFlagValue } from "@/components/shared/Settings/useBetaFlags";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Icon } from "@/components/ui/icon";
import { SidebarMenuItem } from "@/components/ui/sidebar";
import useComponentFromUrl from "@/hooks/useComponentFromUrl";
import { cn } from "@/lib/utils";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { EMPTY_GRAPH_COMPONENT_SPEC } from "@/providers/ComponentSpecProvider";
import { type ComponentItemFromUrlProps } from "@/types/componentLibrary";
import type { ComponentReference, TaskSpec } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";

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
  return (
    <Icon name="File" className="flex-shrink-0 text-gray-400" {...iconProps} />
  );
};

const ComponentIcon = withSuspenseWrapper(
  ({ component, className, ...iconProps }: ComponentIconProps) => {
    const { data: outdatedComponents } = useOutdatedComponents([component]);

    const hasOutdatedComponents = outdatedComponents.length > 0;

    if (!hasOutdatedComponents)
      return <Icon className={className} {...iconProps} />;

    return <Icon name="BookAlert" className="text-orange-500" />;
  },
  ComponentIconSkeleton,
);

const ComponentMarkup = ({
  component,
  isLoading,
  error,
}: ComponentMarkupProps) => {
  const isHighlightTasksOnComponentHoverEnabled = useBetaFlagValue(
    "highlight-node-on-component-hover",
  );
  const isRemoteComponentLibrarySearchEnabled = useBetaFlagValue(
    "remote-component-library-search",
  );

  // TODO: respect selected node as a starting point
  const carousel = useRef(0);
  const { checkIfHighlighted } = useComponentLibrary();
  const { notifyNode, getNodeIdsByDigest, fitNodeIntoView } = useNodesOverlay();

  const { spec, digest, url, name, published_by: author, owned } = component;

  const displayName = useMemo(
    () => name ?? getComponentName({ spec, url }),
    [spec, url, name],
  );

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
  }, [
    digest,
    getNodeIdsByDigest,
    isHighlightTasksOnComponentHoverEnabled,
    notifyNode,
  ]);

  const onMouseLeave = useCallback(() => {
    if (!isHighlightTasksOnComponentHoverEnabled) return;

    if (!digest) return;

    const nodeIds = getNodeIdsByDigest(digest);
    nodeIds.forEach((nodeId) => {
      notifyNode(nodeId, {
        type: "clear",
      });
    });
  }, [
    digest,
    getNodeIdsByDigest,
    isHighlightTasksOnComponentHoverEnabled,
    notifyNode,
  ]);

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

  return (
    <SidebarMenuItem
      className={cn(
        "pl-2 py-1.5",
        error
          ? "cursor-not-allowed opacity-60"
          : "cursor-grab hover:bg-gray-100 active:bg-gray-200",
        checkIfHighlighted(component) && "bg-orange-100",
      )}
      draggable={!error && !isLoading}
      onDragStart={onDragStart}
    >
      <div className="flex items-center gap-2">
        {isLoading ? (
          <span className="text-gray-400 truncate text-sm">Loading...</span>
        ) : error ? (
          <span className="truncate text-xs text-red-500">
            Error loading component
          </span>
        ) : (
          <div
            className="flex-1 flex"
            data-testid="component-item"
            data-component-name={displayName}
          >
            <div className="flex gap-2 w-full items-center">
              {isRemoteComponentLibrarySearchEnabled ? (
                <ComponentIcon
                  name={owned ? "FileBadge" : "File"}
                  className="flex-shrink-0 text-gray-400"
                  component={component}
                />
              ) : (
                <Icon
                  name={owned ? "FileBadge" : "File"}
                  className="flex-shrink-0 text-gray-400"
                />
              )}

              <div
                className="flex flex-col w-[144px]"
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onClick={onMouseClick}
              >
                <span className="truncate text-xs text-gray-800">
                  {displayName}
                </span>
                {author && author.length > 0 ? (
                  <span className="truncate text-[10px] text-gray-500 max-w-[100px] font-mono">
                    {author}
                  </span>
                ) : null}
                <span className="truncate text-[10px] text-gray-500 max-w-[100px] font-mono">
                  Ver: {digest}
                </span>
              </div>
            </div>
            <div className="flex align-items justify-end mr-[15px] h-full">
              <ComponentFavoriteToggle component={component} />
              <ComponentDetailsDialog
                displayName={displayName}
                component={component}
              />
            </div>
          </div>
        )}
      </div>
    </SidebarMenuItem>
  );
};

const ComponentItemFromUrl = ({ url }: ComponentItemFromUrlProps) => {
  const { isLoading, error, componentRef } = useComponentFromUrl(url);

  if (!url) return null;

  if (!componentRef.spec) {
    componentRef.spec = EMPTY_GRAPH_COMPONENT_SPEC;
  }

  return (
    <ComponentMarkup
      component={componentRef}
      isLoading={isLoading}
      error={error}
    />
  );
};

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
        <Icon name="File" className="text-gray-400 flex-shrink-0" />
        <span className="truncate text-xs text-gray-800">
          {nodeType === "input" ? "Input Node" : "Output Node"}
        </span>
      </div>
    </SidebarMenuItem>
  );
};

export { ComponentItemFromUrl, ComponentMarkup };
