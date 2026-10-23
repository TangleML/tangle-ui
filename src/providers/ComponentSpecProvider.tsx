import equal from "fast-deep-equal";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { type UndoRedo, useUndoRedo } from "@/hooks/useUndoRedo";
import { loadPipelineByName } from "@/services/pipelineService";
import { getPipelineCreationBackendUrl } from "@/services/pipelineStorage/pipelineCreation";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { emitPipelineFileChanged } from "@/services/pipelineStorage/pipelineFileEvents";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import type {
  RemotePipelineDraftRef,
  RemotePipelineRef,
} from "@/services/pipelineStorage/types";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";
import { prepareComponentRefForEditor } from "@/utils/prepareComponentRefForEditor";
import {
  getSubgraphComponentSpec,
  updateSubgraphSpec,
} from "@/utils/subgraphUtils";
import {
  checkComponentSpecValidity,
  collectComponentValidationIssues,
  type ComponentValidationIssue,
  type ValidationError,
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
  type ComponentReferenceWithSpec,
  generateDigest,
  getComponentFileFromList,
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
  digest: string;
  isLoading: boolean;
  isValid: boolean;
  errors: ValidationError[];
  isComponentTreeValid: boolean;
  globalValidationIssues: ComponentValidationIssue[];
  refetch: () => void;
  updateGraphSpec: (newGraphSpec: GraphSpec) => void;
  saveComponentSpec: (name: string) => Promise<RemotePipelineRef | void>;
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
  const storage = usePipelineStorage();
  const [componentSpec, setComponentSpec] = useState<ComponentSpec>(
    spec ?? EMPTY_GRAPH_COMPONENT_SPEC,
  );
  const [digest, setDigest] = useState<string>("");
  const remoteSave = useRef<{
    sourceName?: string;
    ref: RemotePipelineDraftRef;
    file: PipelineFile;
    pending?: Promise<void>;
  } | null>(null);
  const saveGeneration = useRef(0);

  const discardRemoteSave = useCallback(() => {
    const saving = remoteSave.current;
    remoteSave.current = null;
    if (!saving) return;
    const discard = () => storage.discardRemoteDraft(saving.ref);
    // Queued writes must settle before releasing their draft's storage entry.
    if (saving.pending) void saving.pending.then(discard, discard);
    else discard();
  }, [storage]);

  const resetRemoteSave = useCallback(() => {
    saveGeneration.current += 1;
    discardRemoteSave();
  }, [discardRemoteSave]);

  useEffect(() => resetRemoteSave, [componentSpec.name, resetRemoteSave]);

  const [isLoading, setIsLoading] = useState(!!spec);

  const [currentSubgraphPath, setCurrentSubgraphPath] = useState<string[]>([
    "root",
  ]);

  const undoRedo = useUndoRedo(componentSpec, setComponentSpec, {
    getMetadata: () => ({ subgraphPath: currentSubgraphPath }),
    onMetadataRestore: (metadata: { subgraphPath: string[] }) => {
      if (!equal(metadata.subgraphPath, currentSubgraphPath)) {
        setCurrentSubgraphPath(metadata.subgraphPath);
      }
    },
  });
  const undoRedoRef = useRef(undoRedo);
  undoRedoRef.current = undoRedo;

  const currentSubgraphSpec = useMemo(() => {
    return getSubgraphComponentSpec(componentSpec, currentSubgraphPath);
  }, [componentSpec, currentSubgraphPath]);

  const isRootSubgraph = currentSubgraphPath.length === 1;

  const { isValid, errors } = useMemo(
    () =>
      checkComponentSpecValidity(currentSubgraphSpec, {
        skipInputValueValidation: !isRootSubgraph,
      }),
    [currentSubgraphSpec, isRootSubgraph],
  );

  const globalValidationIssues = useMemo(
    () => collectComponentValidationIssues(componentSpec),
    [componentSpec],
  );
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
    resetRemoteSave();
    setComponentSpec(EMPTY_GRAPH_COMPONENT_SPEC);
    setIsLoading(false);
    setCurrentSubgraphPath(["root"]);
    undoRedoRef.current.clearHistory();
  }, [resetRemoteSave]);

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
      const generation = saveGeneration.current;

      const specWithName = { ...componentSpec, name };

      const componentText = componentSpecToYaml(specWithName);
      const backendUrl = await getPipelineCreationBackendUrl();
      const existingLocal =
        backendUrl &&
        ((await getComponentFileFromList(USER_PIPELINES_LIST_NAME, name)) ||
          (componentSpec.name &&
            (await getComponentFileFromList(
              USER_PIPELINES_LIST_NAME,
              componentSpec.name,
            ))));
      if (backendUrl && !existingLocal) {
        if (generation !== saveGeneration.current) return;
        if (
          !remoteSave.current ||
          remoteSave.current.sourceName !== componentSpec.name ||
          remoteSave.current.ref.backendUrl !== backendUrl
        ) {
          discardRemoteSave();
          const ref: RemotePipelineDraftRef = {
            source: "draft",
            backendUrl,
            name,
            draftId: crypto.randomUUID(),
          };
          remoteSave.current = {
            sourceName: componentSpec.name,
            ref,
            file: storage.createRemoteDraft(ref),
          };
        }
        const saving = remoteSave.current;
        saving.pending = saving.file.write(componentText);
        await saving.pending;
        return (
          saving.file.remote && {
            source: "remote" as const,
            ...saving.file.remote,
          }
        );
      }
      const file =
        (await storage.resolvePipelineByName(name)) ??
        (await storage.rootFolder.assignFile(name));
      await file.write(componentText);
      emitPipelineFileChanged({ storageKey: name, source: "v1" });
    },
    [componentSpec, discardRemoteSave, readOnly, storage],
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
      digest,
      isLoading,
      isValid,
      errors,
      isComponentTreeValid,
      globalValidationIssues,
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
      digest,
      isLoading,
      isValid,
      errors,
      isComponentTreeValid,
      globalValidationIssues,
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
