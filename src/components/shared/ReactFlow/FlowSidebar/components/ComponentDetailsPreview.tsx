import { useContext } from "react";

import { TaskDetails } from "@/components/shared/TaskDetails";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { getComponentName } from "@/utils/getComponentName";

import { ComponentPreviewContext } from "./ComponentPreviewProvider";

/**
 * ComponentDetailsPreview displays detailed information about a hovered component.
 * It uses TaskDetails to render the component information in a preview panel.
 * This component is designed to be shown in the responsive two-column layout
 * when there is enough space (maximized window).
 */
export const ComponentDetailsPreview = () => {
  const previewContext = useContext(ComponentPreviewContext);
  const hoveredComponent = previewContext?.hoveredComponent ?? null;

  // Base classes for the preview panel - hidden by default, shown in two-column layout
  const previewClasses =
    "hidden @[600px]:flex flex-col overflow-y-auto bg-background @[600px]:border-l @[600px]:border-border";

  if (!hoveredComponent) {
    return (
      <BlockStack
        gap="2"
        align="center"
        className={`h-full items-center justify-center p-4 ${previewClasses}`}
      >
        <Icon name="MousePointer2" className="text-gray-400 size-8" />
        <Text size="sm" tone="subdued" className="text-center">
          Hover over a component to see details
        </Text>
      </BlockStack>
    );
  }

  const displayName =
    hoveredComponent.name ??
    getComponentName({
      spec: hoveredComponent.spec,
      url: hoveredComponent.url,
    });

  return (
    <BlockStack gap="2" className={`h-full overflow-auto p-3 ${previewClasses}`}>
      <Text as="h2" size="sm" weight="semibold" className="truncate" title={displayName}>
        {displayName}
      </Text>
      <TaskDetails
        componentRef={hoveredComponent}
        readOnly
        options={{ descriptionExpanded: true }}
      />
    </BlockStack>
  );
};

