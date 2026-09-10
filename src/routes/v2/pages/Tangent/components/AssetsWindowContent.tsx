import type { EmbedAsset } from "@tangent/embed-react";
import { AssetList } from "@tangent/embed-react";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";

export function AssetsWindowContent() {
  const { activeSessionId, tabs, onOpenArtifact } = useTangentProject();

  function handleOpenAsset(asset: EmbedAsset) {
    tabs.selectAsset(asset);
    if (asset.kind !== "trigger") {
      onOpenArtifact(asset.url, asset.title);
    }
  }

  if (!activeSessionId) {
    return (
      <BlockStack gap="1" className="p-2">
        <Text size="xs" tone="subdued">
          Start a session to see its assets.
        </Text>
      </BlockStack>
    );
  }

  return (
    <AssetList
      sessionId={activeSessionId}
      selectedId={tabs.selectedAssetId}
      onOpen={handleOpenAsset}
    />
  );
}
