import { reaction } from "mobx";
import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";

import type { ComponentSpec } from "@/models/componentSpec";

import { editorStore } from "../store/editorStore";
import { navigationStore } from "../store/navigationStore";

export function useNavigationSync(
  setActiveSpec: Dispatch<SetStateAction<ComponentSpec | null>>,
) {
  useEffect(() => {
    const dispose = reaction(
      () => navigationStore.navigationPath.map((e) => e.specId).join("/"),
      () => {
        const path = navigationStore.navigationPath;
        if (path.length === 0) return;

        if (path.length === 1) {
          setActiveSpec(navigationStore.rootSpec);
        } else {
          const pathKey = path
            .slice(1)
            .map((e) => e.displayName)
            .join("/");
          const nestedSpec = navigationStore.nestedSpecs.get(pathKey);
          if (nestedSpec) {
            setActiveSpec(nestedSpec);
          }
        }

        editorStore.clearSelection();
      },
    );
    return dispose;
  }, []);
}
