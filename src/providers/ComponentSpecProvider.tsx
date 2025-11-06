import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";

import { type UndoRedo, useUndoRedo } from "@/hooks/useUndoRedo";
import { loadPipelineByName } from "@/services/pipelineService";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";
import { prepareComponentRefForEditor } from "@/utils/prepareComponentRefForEditor";
import {
  getSubgraphComponentSpec,
  updateSubgraphSpec,
} from "@/utils/subgraphUtils";
import { checkComponentSpecValidity } from "@/utils/validations";

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
  type ComponentReferenceWithSpec,
  componentSpecToYaml,
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
  graphSpec: GraphSpec;
  currentGraphSpec: GraphSpec;
  currentSubgraphSpec: ComponentSpec;
  isLoading: boolean;
  isValid: boolean;
  errors: string[];
  refetch: () => void;
  updateGraphSpec: (newGraphSpec: GraphSpec) => void;
  saveComponentSpec: (name: string) => Promise<void>;
  undoRedo: UndoRedo;

  currentSubgraphPath: string[];
  navigateToSubgraph: (taskId: string) => void;
  navigateBack: () => void;
  navigateToPath: (targetPath: string[]) => void;
  canNavigateBack: boolean;
}

const ComponentSpecContext = createRequiredContext<ComponentSpecContextType>(
  "ComponentSpecProvider",
);

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

  const [isLoading, setIsLoading] = useState(!!spec);

  const [currentSubgraphPath, setCurrentSubgraphPath] = useState<string[]>([
    "root",
  ]);

  const undoRedo = useUndoRedo(componentSpec, setComponentSpec);
  const undoRedoRef = useRef(undoRedo);
  undoRedoRef.current = undoRedo;

  const currentSubgraphSpec = useMemo(() => {
    return getSubgraphComponentSpec(componentSpec, currentSubgraphPath);
  }, [componentSpec, currentSubgraphPath]);

  const { isValid, errors } = useMemo(
    () => checkComponentSpecValidity(currentSubgraphSpec),
    [currentSubgraphSpec],
  );

  const clearComponentSpec = useCallback(() => {
    setComponentSpec(EMPTY_GRAPH_COMPONENT_SPEC);
    setIsLoading(false);
    setCurrentSubgraphPath(["root"]);
    undoRedoRef.current.clearHistory();
  }, []);

  const graphSpec = useMemo(() => {
    if (isGraphImplementation(componentSpec.implementation)) {
      return componentSpec.implementation.graph;
    }

    return EMPTY_GRAPH_SPEC;
  }, [componentSpec]);

  const currentGraphSpec = useMemo(() => {
    if (isGraphImplementation(currentSubgraphSpec.implementation)) {
      return currentSubgraphSpec.implementation.graph;
    }

    return EMPTY_GRAPH_SPEC;
  }, [currentSubgraphSpec]);

  const loadPipeline = useCallback(
    async (newName?: string) => {
      if (componentSpec) {
        setComponentSpec(componentSpec);
      }

      const name = newName ?? componentSpec.name;
      if (!name) return;

      const result = await loadPipelineByName(name);
      if (!result.experiment) return;

      const preparedComponentRef = await prepareComponentRefForEditor(
        result.experiment.componentRef as ComponentReferenceWithSpec,
      );

      if (!preparedComponentRef) {
        console.error("Failed to prepare component reference for editor");
        return;
      }

      setComponentSpec(preparedComponentRef);
      setIsLoading(false);
    },
    [componentSpec],
  );

  const refetch = useCallback(() => {
    loadPipeline();
  }, [loadPipeline]);

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

  const navigateToSubgraph = useCallback((taskId: string) => {
    setCurrentSubgraphPath((prev) => [...prev, taskId]);
  }, []);

  const navigateBack = useCallback(() => {
    setCurrentSubgraphPath((prev) => prev.slice(0, -1));
  }, []);

  const navigateToPath = useCallback((targetPath: string[]) => {
    setCurrentSubgraphPath(targetPath);
  }, []);

  const canNavigateBack = currentSubgraphPath.length > 1;

  const value = useMemo(
    () => ({
      componentSpec,
      graphSpec,
      currentGraphSpec,
      currentSubgraphSpec,
      isLoading,
      isValid,
      errors,
      refetch,
      setComponentSpec,
      clearComponentSpec,
      saveComponentSpec,
      updateGraphSpec,
      undoRedo,

      currentSubgraphPath,
      navigateToSubgraph,
      navigateBack,
      navigateToPath,
      canNavigateBack,
    }),
    [
      componentSpec,
      graphSpec,
      currentGraphSpec,
      currentSubgraphSpec,
      isLoading,
      isValid,
      errors,
      refetch,
      setComponentSpec,
      clearComponentSpec,
      saveComponentSpec,
      updateGraphSpec,
      undoRedo,

      currentSubgraphPath,
      navigateToSubgraph,
      navigateBack,
      navigateToPath,
      canNavigateBack,
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
