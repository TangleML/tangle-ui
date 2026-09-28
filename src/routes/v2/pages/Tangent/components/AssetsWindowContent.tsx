import type { EmbedAsset } from "@tangent/embed-react";
import { AssetList } from "@tangent/embed-react";
import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";

export const AssetsWindowContent = observer(function AssetsWindowContent() {
  const store = useTangentProject();
  const activeSessionId = store.activeSessionId;

  function handleOpenAsset(asset: EmbedAsset) {
    store.selectAsset(asset);
    if (asset.kind !== "trigger") {
      store.openArtifactTab(asset.url, asset.title);
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
      selectedId={store.selectedAssetId}
      onOpen={handleOpenAsset}
    />
  );
});
