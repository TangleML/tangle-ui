import {
  isRootStore,
  registerRootStore,
  unregisterRootStore,
} from "mobx-keystone";
import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function useReadOnlySpecLifecycle(rootSpec: ComponentSpec) {
  const { editor, navigation } = useSharedStores();

  useEffect(() => {
    if (!rootSpec) return;

    if (!isRootStore(rootSpec)) registerRootStore(rootSpec);
    editor.resetState();
    navigation.initNavigation(rootSpec);

    return () => {
      navigation.clearNavigation();
      editor.resetState();
      if (isRootStore(rootSpec)) {
        unregisterRootStore(rootSpec);
      }
    };
  }, [rootSpec, editor, navigation]);
}
