import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useComponentSpecStore } from "@/stores/componentSpecStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";
import {
  getSubgraphComponentSpec,
  updateSubgraphSpec,
} from "@/utils/subgraphUtils";
import {
  collectComponentValidationIssues,
  type ComponentValidationIssue,
} from "@/utils/validations";
import { componentSpecToYaml } from "@/utils/yaml";

import {
  createRequiredContext,
  useRequiredContext,
} from "../hooks/useRequiredContext";
import {
  type ComponentSpec,
  type GraphSpec,
  isGraphImplementation,
} from "../utils/componentSpec";
import {
  generateDigest,
  writeComponentToFileListFromText,
} from "../utils/componentStore";

const EMPTY_GRAPH_SPEC: GraphSpec = {
  tasks: {},
};

export const EMPTY_GRAPH_COMPONENT_SPEC: ComponentSpec = {
  implementation: {
    graph: EMPTY_GRAPH_SPEC,
  },
};
interface ComponentSpecContextType {
  componentSpec: ComponentSpec;
  setComponentSpec: (spec: ComponentSpec) => void;
  clearComponentSpec: () => void;
  currentGraphSpec: GraphSpec;
  currentSubgraphSpec: ComponentSpec;
  digest: string;
  isLoading: boolean;
  isComponentTreeValid: boolean;
  globalValidationIssues: ComponentValidationIssue[];
  updateGraphSpec: (newGraphSpec: GraphSpec) => void;
  saveComponentSpec: (name: string) => Promise<void>;

  currentSubgraphPath: string[];
}

const ComponentSpecContext = createRequiredContext<ComponentSpecContextType>(
  "ComponentSpecProvider",
);

/**
 * Module-level refs for context actions. Components migrated to store selectors
 * can call these without subscribing to the full context (avoiding re-renders).
 * Updated on every render of ComponentSpecProvider.
 */
export const componentSpecActions = {
  updateGraphSpec: null as ((newGraphSpec: GraphSpec) => void) | null,
  setComponentSpec: null as ((spec: ComponentSpec) => void) | null,
};

export const ComponentSpecProvider = ({
  spec,
  readOnly = false,
  children,
}: {
  spec?: ComponentSpec;
  readOnly?: boolean;
  children: ReactNode;
}) => {
  const [componentSpec, setComponentSpec] = useState<ComponentSpec>(
    spec ?? EMPTY_GRAPH_COMPONENT_SPEC,
  );
  const [digest, setDigest] = useState<string>("");

  const [isLoading, setIsLoading] = useState(!!spec);

  const [currentSubgraphPath, setCurrentSubgraphPath] = useState<string[]>([
    "root",
  ]);

  // Bridge: sync componentSpec into the Zustand store so that
  // components migrated in later phases can read from store selectors.
  // Skip re-decomposition when the store was already updated by a direct mutation
  // (e.g. setTaskArguments) to preserve referential stability.
  const lastSyncedMutationVersionRef = useRef(0);
  useEffect(() => {
    const currentVersion =
      useComponentSpecStore.getState()._directMutationVersion;
    if (currentVersion !== lastSyncedMutationVersionRef.current) {
      lastSyncedMutationVersionRef.current = currentVersion;
      return;
    }
    useComponentSpecStore.getState().loadFromComponentSpec(componentSpec);
  }, [componentSpec]);

  // Bridge: context→store path sync (guard against redundant updates)
  useEffect(() => {
    const storePath = useComponentSpecStore.getState().currentSubgraphPath;
    if (JSON.stringify(storePath) !== JSON.stringify(currentSubgraphPath)) {
      useComponentSpecStore.getState().navigateToPath(currentSubgraphPath);
    }
  }, [currentSubgraphPath]);

  // Bridge: store→context path sync (enables components to navigate via store)
  useEffect(() => {
    const unsubscribe = useComponentSpecStore.subscribe((state, prevState) => {
      if (state.currentSubgraphPath !== prevState.currentSubgraphPath) {
        setCurrentSubgraphPath((prev) => {
          if (
            JSON.stringify(prev) === JSON.stringify(state.currentSubgraphPath)
          )
            return prev;
          return state.currentSubgraphPath;
        });
      }
    });
    return unsubscribe;
  }, []);

  // Bridge: store→context sync for direct mutations (including undo/redo).
  // When any direct store mutation fires (detected by _directMutationVersion change),
  // compile the store back to a ComponentSpec and push it into context so remaining
  // consumers stay in sync.
  useEffect(() => {
    const unsubscribe = useComponentSpecStore.subscribe((state, prevState) => {
      if (state._directMutationVersion !== prevState._directMutationVersion) {
        const compiledSpec = useComponentSpecStore
          .getState()
          .compileComponentSpec();
        setComponentSpec(compiledSpec);
      }
    });
    return unsubscribe;
  }, []);

  const currentSubgraphSpec = useMemo(() => {
    return getSubgraphComponentSpec(componentSpec, currentSubgraphPath);
  }, [componentSpec, currentSubgraphPath]);

  // Debounced global validation (1s) — the validation panel and submission
  // eligibility don't need instant updates; debouncing avoids the expensive
  // recursive tree traversal on every keystroke.
  const [globalValidationIssues, setGlobalValidationIssues] = useState<
    ComponentValidationIssue[]
  >(() => collectComponentValidationIssues(componentSpec));
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalValidationIssues(
        collectComponentValidationIssues(componentSpec),
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [componentSpec]);
  const isComponentTreeValid = globalValidationIssues.length === 0;

  useEffect(() => {
    let isCancelled = false;

    const computeDigest = async () => {
      const text = componentSpecToYaml(componentSpec);
      const newDigest = await generateDigest(text);
      if (!isCancelled) {
        setDigest(newDigest);
      }
    };

    computeDigest();

    return () => {
      isCancelled = true;
    };
  }, [componentSpec]);

  const clearComponentSpec = useCallback(() => {
    setComponentSpec(EMPTY_GRAPH_COMPONENT_SPEC);
    setIsLoading(false);
    setCurrentSubgraphPath(["root"]);
    useComponentSpecStore.getState().clearHistory();
  }, []);

  const currentGraphSpec = useMemo(() => {
    if (isGraphImplementation(currentSubgraphSpec.implementation)) {
      return currentSubgraphSpec.implementation.graph;
    }

    return EMPTY_GRAPH_SPEC;
  }, [currentSubgraphSpec]);

  const saveComponentSpec = useCallback(
    async (name: string) => {
      if (readOnly) {
        return;
      }

      const specWithName = { ...componentSpec, name };

      const componentText = componentSpecToYaml(specWithName);
      await writeComponentToFileListFromText(
        USER_PIPELINES_LIST_NAME,
        name,
        componentText,
      );
    },
    [componentSpec, readOnly],
  );

  const updateGraphSpec = useCallback(
    (newGraphSpec: GraphSpec) => {
      setComponentSpec((prevSpec) => {
        // Get current subgraph spec (at root, this is prevSpec itself)
        const currentSubgraphSpec = getSubgraphComponentSpec(
          prevSpec,
          currentSubgraphPath,
        );

        // Update its graph
        const updatedSubgraphSpec: ComponentSpec = {
          ...currentSubgraphSpec,
          implementation: {
            ...currentSubgraphSpec.implementation,
            graph: newGraphSpec,
          },
        };

        // Propagate changes back to root (handles root as early return)
        return updateSubgraphSpec(
          prevSpec,
          currentSubgraphPath,
          updatedSubgraphSpec,
        );
      });
    },
    [currentSubgraphPath],
  );

  // Keep action refs up-to-date for components using store selectors
  useEffect(() => {
    componentSpecActions.updateGraphSpec = updateGraphSpec;
    componentSpecActions.setComponentSpec = setComponentSpec;
  }, [updateGraphSpec, setComponentSpec]);

  const value = useMemo(
    () => ({
      componentSpec,
      currentGraphSpec,
      currentSubgraphSpec,
      digest,
      isLoading,
      isComponentTreeValid,
      globalValidationIssues,
      setComponentSpec,
      clearComponentSpec,
      saveComponentSpec,
      updateGraphSpec,

      currentSubgraphPath,
    }),
    [
      componentSpec,
      currentGraphSpec,
      currentSubgraphSpec,
      digest,
      isLoading,
      isComponentTreeValid,
      globalValidationIssues,
      setComponentSpec,
      clearComponentSpec,
      saveComponentSpec,
      updateGraphSpec,

      currentSubgraphPath,
    ],
  );

  return (
    <ComponentSpecContext.Provider value={value}>
      {children}
    </ComponentSpecContext.Provider>
  );
};

export const useComponentSpec = () => {
  return useRequiredContext(ComponentSpecContext);
};
