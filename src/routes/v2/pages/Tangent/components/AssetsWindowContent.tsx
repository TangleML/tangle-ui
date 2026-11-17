import type { EmbedAsset } from "@tangent/embed-react";
import { AssetList } from "@tangent/embed-react";
import { observer } from "mobx-react-lite";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";

import { useDismissProjectCard } from "./projectCardContext";

export const AssetsWindowContent = observer(function AssetsWindowContent() {
  const store = useTangentProject();
  const dismissCard = useDismissProjectCard();
  const activeSessionId = store.activeSessionId;

  function handleOpenAsset(asset: EmbedAsset) {
    store.selectAsset(asset);
    dismissCard();
    if (asset.kind === "trigger") return;
    store.openArtifactTab(asset.url, asset.title);
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
