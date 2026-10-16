import { Controls, ReactFlowProvider } from "@xyflow/react";
import { observer } from "mobx-react-lite";

import logo from "/Tangle_Icon_White.png";
import { Badge } from "@/components/ui/badge";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec } from "@/models/componentSpec";
import { ComponentLibraryProvider } from "@/providers/ComponentLibraryProvider";
import { AppMenuActions } from "@/routes/v2/shared/components/AppMenuActions";
import { ReadOnlyFlowCanvas } from "@/routes/v2/shared/components/ReadOnlyFlowCanvas";
import { useReadOnlySpecLifecycle } from "@/routes/v2/shared/hooks/useReadOnlySpecLifecycle";
import { NodeRegistryProvider } from "@/routes/v2/shared/nodes/NodeRegistryContext";
import { SpecProvider } from "@/routes/v2/shared/providers/SpecContext";
import {
  SharedStoreProvider,
  useSharedStores,
} from "@/routes/v2/shared/store/SharedStoreContext";

import { remotePipelineViewRegistry } from "./remotePipelineViewRegistry";

const RemotePipelineContent = observer(function RemotePipelineContent({
  spec,
}: {
  spec: ComponentSpec;
}) {
  const { navigation } = useSharedStores();
  useReadOnlySpecLifecycle(spec);

  const activeSpec = navigation.activeSpec;

  return (
    <BlockStack
      fill
      align="stretch"
      inlineAlign="start"
      className="bg-slate-100 dark:bg-background select-none"
    >
      <InlineStack
        align="space-between"
        blockAlign="center"
        wrap="nowrap"
        className="h-14 w-full shrink-0 bg-stone-900 px-3 md:px-4"
      >
        <InlineStack
          gap="3"
          blockAlign="center"
          wrap="nowrap"
          className="min-w-0"
        >
          <Link href="/" aria-label="Home" variant="block" className="shrink-0">
            <img src={logo} alt="logo" className="h-8" />
          </Link>
          <Text size="sm" weight="semibold" className="text-white truncate">
            {spec.name || "Untitled pipeline"}
          </Text>
          <Badge size="sm" className="shrink-0">
            View only
          </Badge>
        </InlineStack>
        <AppMenuActions />
      </InlineStack>
      {activeSpec && (
        <SpecProvider spec={activeSpec}>
          <ReadOnlyFlowCanvas
            key={activeSpec.$id}
            spec={activeSpec}
            nodesDraggable={false}
            className="flex-1 min-h-0"
          >
            <Controls showInteractive={false} />
          </ReadOnlyFlowCanvas>
        </SpecProvider>
      )}
    </BlockStack>
  );
});

export function RemotePipelineView({ spec }: { spec: ComponentSpec }) {
  return (
    <ComponentLibraryProvider>
      <SharedStoreProvider>
        <ReactFlowProvider>
          <NodeRegistryProvider registry={remotePipelineViewRegistry}>
            <RemotePipelineContent spec={spec} />
          </NodeRegistryProvider>
        </ReactFlowProvider>
      </SharedStoreProvider>
    </ComponentLibraryProvider>
  );
}
