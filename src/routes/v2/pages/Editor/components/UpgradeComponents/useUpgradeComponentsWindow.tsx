import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { BlockStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { UpgradeComponentsContent } from "./UpgradeComponentsContent";

const WINDOW_ID = "upgrade-components";
const WINDOW_SIZE = { width: 720, height: 480 };

function UpgradeComponentsWindowFallback() {
  return (
    <BlockStack
      className="h-full gap-3 p-4"
      data-testid="upgrade-components-window-fallback"
    >
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="min-h-32 flex-1 w-full" />
      <Skeleton className="h-9 w-28" />
    </BlockStack>
  );
}

const UpgradeComponentsContentRealWithBoundary = withSuspenseWrapper(
  function UpgradeComponentsContentRealBoundary() {
    return <UpgradeComponentsContent dataSource="real" />;
  },
  UpgradeComponentsWindowFallback,
);

interface OpenUpgradeComponentsWindowOptions {
  useMock?: boolean;
}

export function useUpgradeComponentsWindow() {
  const { windows, keyboard } = useSharedStores();

  const openUpgradeComponentsWindow = (
    options?: OpenUpgradeComponentsWindowOptions,
  ) => {
    const position = { x: globalThis.innerWidth - WINDOW_SIZE.width, y: 60 };

    // todo: replace ad-hoc solution with more robust solution
    keyboard.invokeShortcut("focus-mode");

    const content =
      options?.useMock === true ? (
        <UpgradeComponentsContent dataSource="mock" />
      ) : (
        <UpgradeComponentsContentRealWithBoundary />
      );

    windows.openWindow(content, {
      id: WINDOW_ID,
      title: "Upgrade Components",
      size: WINDOW_SIZE,
      minSize: { width: 600, height: 300 },
      position,
      startVisible: true,
      disabledActions: ["hide", "minimize", "maximize"],
      onClose: () => keyboard.invokeShortcut("focus-mode"),
    });
  };

  return openUpgradeComponentsWindow;
}
