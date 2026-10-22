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
import {
  collectUsedComponentReferences,
  EMPTY_USED_COMPONENTS,
} from "@/models/componentSpec/collectUsedComponentReferences";
import { useUpgradeComponentsWindow } from "@/routes/v2/pages/Editor/components/UpgradeComponents/useUpgradeComponentsWindow";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { getStorage } from "@/utils/typedStorage";

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

const UpgradeAvailableAlertBoxInner = observer(
  function UpgradeAvailableAlertBoxInner() {
    const openUpgradeComponentsWindow = useUpgradeComponentsWindow();
    const spec = useSpec();

    const usedComponents = spec
      ? collectUsedComponentReferences(spec)
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

export const UpgradeAvailableAlertBox = withSuspenseWrapper(
  UpgradeAvailableAlertBoxInner,
  UpgradeAvailableAlertBoxSkeleton,
  () => null,
);

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
