import { observer } from "mobx-react-lite";
import { useCallback, useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { useOutdatedComponents } from "@/components/shared/ManageComponent/hooks/useOutdatedComponents";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Button } from "@/components/ui/button";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { useUpgradeComponentsWindow } from "@/routes/v2/pages/Editor/components/UpgradeComponents/useUpgradeComponentsWindow";
import {
  collectUsedComponentReferencesFromV2Spec,
  EMPTY_USED_COMPONENTS,
} from "@/routes/v2/pages/Editor/components/UpgradeComponents/utils/collectUsedComponentReferencesFromV2Spec";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useOptionalWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { getStorage } from "@/utils/typedStorage";

import { useNodesOverlay } from "../../NodesOverlay/NodesOverlayProvider";

const UpgradeAvailableAlertBoxSkeleton = () => {
  return (
    <BlockStack className="px-2">
      <Skeleton size="lg" className="h-4 w-full" />
    </BlockStack>
  );
};

interface UpgradeAlertViewProps {
  onReview: () => void;
  onDismiss: () => void;
}

function UpgradeAlertView({ onReview, onDismiss }: UpgradeAlertViewProps) {
  return (
    <BlockStack className="px-2">
      <InfoBox title="Upgrades available" key="outdated-components">
        <BlockStack gap="2">
          <Paragraph size="xs">
            You have outdated components used in your Pipeline.
          </Paragraph>
          <InlineStack align="space-between" className="w-full">
            <Button size="xs" variant="secondary" onClick={onDismiss}>
              Dismiss
            </Button>
            <Button size="xs" onClick={onReview}>
              Review
            </Button>
          </InlineStack>
        </BlockStack>
      </InfoBox>
    </BlockStack>
  );
}

/**
 * Computes alert visibility (outdated > 0 && not dismissed) and a dismiss
 * callback that persists the dismissal and toasts the user.
 */
function useUpgradeAlertVisibility(outdatedCount: number) {
  const notify = useToastNotification();
  const [dismissed, setDismissed] = useDissmissedStorage();

  const dismiss = useCallback(() => {
    setDismissed();
    notify("Upgrade alert dismissed for next 24 hours", "success");
  }, [setDismissed, notify]);

  return {
    visible: outdatedCount > 0 && !dismissed,
    dismiss,
  };
}

const UpgradeAvailableAlertBoxLegacy = withSuspenseWrapper(
  function UpgradeAvailableAlertBoxLegacyInner() {
    const { usedComponentsFolder } = useComponentLibrary();

    const { data: outdatedComponents } = useOutdatedComponents(
      usedComponentsFolder.components ?? [],
    );

    const { visible, dismiss } = useUpgradeAlertVisibility(
      outdatedComponents.length,
    );

    const { notifyNode, getNodeIdsByDigest, fitNodeIntoView } =
      useNodesOverlay();

    const upgradeAllComponentsCallback = useCallback(async () => {
      if (outdatedComponents.length === 0) {
        return;
      }

      const nodeIds = outdatedComponents.flatMap(([outdated, _]) =>
        getNodeIdsByDigest(outdated.digest),
      );

      if (nodeIds.length === 0) {
        return;
      }

      const nodeId = nodeIds.pop();

      if (!nodeId) {
        return;
      }

      await fitNodeIntoView(nodeId);

      notifyNode(nodeId, {
        type: "update-overlay",
        data: {
          replaceWith: new Map(
            outdatedComponents.map(([outdated, mrc]) => [outdated.digest, mrc]),
          ),
          ids: nodeIds,
        },
      });
    }, [getNodeIdsByDigest, fitNodeIntoView, notifyNode, outdatedComponents]);

    if (!visible) {
      return null;
    }

    return (
      <UpgradeAlertView
        onDismiss={dismiss}
        onReview={upgradeAllComponentsCallback}
      />
    );
  },
  UpgradeAvailableAlertBoxSkeleton,
  () => null,
);

const UpgradeAvailableAlertBoxV2WindowInner = observer(
  function UpgradeAvailableAlertBoxV2WindowInner() {
    const openUpgradeComponentsWindow = useUpgradeComponentsWindow();
    const spec = useSpec();

    const usedComponents = spec
      ? collectUsedComponentReferencesFromV2Spec(spec)
      : EMPTY_USED_COMPONENTS;

    const { data: outdatedComponents } = useOutdatedComponents(usedComponents);

    const { visible, dismiss } = useUpgradeAlertVisibility(
      outdatedComponents.length,
    );

    if (!spec || !visible) {
      return null;
    }

    return (
      <UpgradeAlertView
        onDismiss={dismiss}
        onReview={() => openUpgradeComponentsWindow()}
      />
    );
  },
);

const UpgradeAvailableAlertBoxV2Window = withSuspenseWrapper(
  UpgradeAvailableAlertBoxV2WindowInner,
  UpgradeAvailableAlertBoxSkeleton,
  () => null,
);

/**
 * When this component is rendered inside the v2 window chrome (e.g. docked
 * Component Library), `useOptionalWindowContext()` is defined and Review opens
 * the v2 Upgrade Components window. In the v1 sidebar there is no window
 * context; Review uses the nodes overlay flow instead.
 */
export function UpgradeAvailableAlertBox() {
  const windowCtx = useOptionalWindowContext();
  if (windowCtx) {
    return <UpgradeAvailableAlertBoxV2Window />;
  }
  return <UpgradeAvailableAlertBoxLegacy />;
}

interface DismissedStorage {
  upgradeAvailableAlertDismissed: Date | undefined;
}

const storage = getStorage<keyof DismissedStorage, DismissedStorage>({
  encode: (value: Date | undefined) => value?.toISOString() ?? "",
  decode: (value) => new Date(value),
});

function useDissmissedStorage() {
  const [dismissed, setDismissed] = useState(
    storage.getItem("upgradeAvailableAlertDismissed"),
  );
  const setDismissedValue = useCallback(() => {
    /**
     * Default behavior is to dismiss the alert for 1 day
     */
    const value = new Date(Date.now() + 1000 * 60 * 60 * 24);
    storage.setItem("upgradeAvailableAlertDismissed", value);
    setDismissed(value);
  }, []);

  return [dismissed && dismissed > new Date(), setDismissedValue] as const;
}
