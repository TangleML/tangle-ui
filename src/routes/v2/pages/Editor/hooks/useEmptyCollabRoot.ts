import {
  isRootStore,
  registerRootStore,
  unregisterRootStore,
} from "mobx-keystone";
import { useEffect, useState } from "react";

import {
  type ComponentSpec,
  IncrementingIdGenerator,
  YamlDeserializer,
} from "@/models/componentSpec";

const EMPTY_PIPELINE_SPEC = {
  implementation: { graph: { tasks: {} } },
};

/**
 * A collab room is seeded by the server, not by local storage, so the editor
 * opens on a throwaway empty root. The first `hello` fills it in through
 * `applyCollabSnapshot`.
 */
export function useEmptyCollabRoot(): ComponentSpec {
  const [root] = useState<ComponentSpec>(() =>
    new YamlDeserializer(new IncrementingIdGenerator()).deserialize(
      EMPTY_PIPELINE_SPEC,
    ),
  );

  useEffect(() => {
    if (!isRootStore(root)) registerRootStore(root);
    return () => {
      if (isRootStore(root)) unregisterRootStore(root);
    };
  }, [root]);

  return root;
}
