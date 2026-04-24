import type {
  Edge,
  EdgeProps,
  Node,
  NodeProps,
  XYPosition,
} from "@xyflow/react";
import type { ComponentType, MouseEvent } from "react";

import type { ComponentSpec } from "@/models/componentSpec";
import type { GuidelineOrientation } from "@/models/componentSpec/annotations";
import type { IdGenerator } from "@/models/componentSpec/factories/idGenerator";
import type {
  EditorStore,
  SelectedNode,
} from "@/routes/v2/shared/store/editorStore";
import type { KeyboardStore } from "@/routes/v2/shared/store/keyboardStore";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";

/**
 * Minimal interface for undo grouping, satisfied by UndoStore.
 * Defined here so shared/ doesn't import from pages/.
 */
export interface UndoGroupable {
  withGroup<T>(label: string, fn: () => T): T;
}

// ---------------------------------------------------------------------------
// Snapshot types (used by clone handlers and copy-paste)
// ---------------------------------------------------------------------------

export interface NodeSnapshot<TData = unknown> {
  $type: string;
  entityId: string;
  name: string;
  position: XYPosition;
  data: TData;
}

interface NodeSnapshotHandler {
  snapshot(spec: ComponentSpec, entityId: string): NodeSnapshot | null;
}

export interface BindingSnapshot {
  sourceEntityId: string;
  targetEntityId: string;
  sourcePortName: string;
  targetPortName: string;
}

// ---------------------------------------------------------------------------
// Clone handler types (re-exported for use in manifests)
// ---------------------------------------------------------------------------

interface NodeCloneHandler {
  snapshot(spec: ComponentSpec, entityId: string): NodeSnapshot | null;
  clone(
    spec: ComponentSpec,
    snapshot: NodeSnapshot,
    idGen: IdGenerator,
    position: XYPosition,
    undo: UndoGroupable,
  ): string | null;
}

// ---------------------------------------------------------------------------
// Node data types used by manifests and components
// ---------------------------------------------------------------------------

export interface TaskNodeData extends Record<string, unknown> {
  entityId: string;
  name: string;
}

export interface IONodeData extends Record<string, unknown> {
  entityId: string;
  ioType: "input" | "output";
  name: string;
}

export interface ConduitNodeData extends Record<string, unknown> {
  conduitId: string;
  color: string;
  edgeCount: number;
  orientation: GuidelineOrientation;
  coordinate: number;
}

export interface ConduitEdgeData extends Record<string, unknown> {
  guidelines: GuidelineInfo[];
  conduitColor?: string;
  isInAssignmentMode?: boolean;
  isAssignedToActiveConduit?: boolean;
  activeConduitColor?: string;
}

export interface GuidelineInfo {
  orientation: GuidelineOrientation;
  coordinate: number;
  edgeIndex: number;
  edgeTotal: number;
}

type DropHandler = (
  spec: ComponentSpec,
  data: unknown,
  position: XYPosition,
  undo: UndoGroupable,
) => void | Promise<void>;

// ---------------------------------------------------------------------------
// NodeTypeManifest – the contract every node-type plugin implements
// ---------------------------------------------------------------------------

export interface NodeTypeManifest {
  /** React Flow node type key (e.g. "task", "input", "output", "conduit", "ghost"). */
  readonly type: string;

  /** Node ID prefix used to identify this type from an id string. */
  readonly idPrefix: string;

  /**
   * Domain entity type (e.g. "task", "input", "output", "conduit").
   */
  readonly entityType: string;
  hasEntityId?(spec: ComponentSpec, id: string): boolean;

  // -- Rendering --------------------------------------------------------

  readonly component: ComponentType<NodeProps<any>>;
  readonly edgeTypes?: Record<string, ComponentType<EdgeProps<any>>>;

  // -- Spec → React Flow ------------------------------------------------

  buildNodes(spec: ComponentSpec): Node[];
  buildEdges?(spec: ComponentSpec): Edge[];

  /**
   * Transform the base binding edges (e.g. replace "default" edges with
   * a specialised edge type). Called after `buildBindingEdges`.
   */
  transformEdges?(spec: ComponentSpec, edges: Edge[]): Edge[];

  // -- Canvas operations ------------------------------------------------

  readonly drop?: {
    /** Key in the `application/reactflow` JSON payload. */
    readonly dataKey: string;
    handler: DropHandler;
  };

  /**
   * Used to get the position of a node from the spec.
   * CopyPaste features rely on this to fetch position of the node regardless of the node type.
   * @param spec
   * @param nodeId
   */
  getPosition(spec: ComponentSpec, nodeId: string): XYPosition | undefined;

  updatePosition(
    undo: UndoGroupable,
    spec: ComponentSpec,
    nodeId: string,
    position: XYPosition,
  ): void;

  deleteNode(undo: UndoGroupable, spec: ComponentSpec, nodeId: string): void;

  findEntity?(spec: ComponentSpec, entityId: string): unknown | undefined;

  // -- Selection --------------------------------------------------------

  readonly selectable: boolean;
  toSelectedNode?(node: Node): SelectedNode | null;
  readonly contextPanelComponent?: ComponentType<{ entityId: string }>;

  // -- Display metadata (multi-selection, etc.) -------------------------

  displayName?(spec: ComponentSpec, entityId: string): string;
  readonly icon?: string;
  readonly iconColor?: string;

  // -- Interactions -----------------------------------------------------

  onDoubleClick?(
    spec: ComponentSpec,
    node: Node,
    navigation: NavigationStore,
    windows: WindowStoreImpl,
  ): void;
  onPaneClick?(
    spec: ComponentSpec,
    position: XYPosition,
    stores: {
      editor: EditorStore;
      keyboard: KeyboardStore;
      undo: UndoGroupable;
    },
  ): void;

  // -- Snapshot (read-only, shared by Editor and RunView) ----------------

  readonly snapshotHandler?: NodeSnapshotHandler;

  // -- Clone / copy-paste (Editor-only) ---------------------------------

  readonly cloneHandler?: NodeCloneHandler;

  // -- Canvas enhancement (runtime hooks) ---------------------------------

  /**
   * Optional React hook called by the composing `useCanvasEnhancements` hook.
   * Manifests use this to inject extra nodes/edges or transform edges at
   * render time (e.g. ghost-node overlay, conduit edge styling).
   *
   * Safe to use React hooks inside — the manifest array is static so call
   * order is stable across renders.
   */
  readonly useCanvasEnhancement?: (
    params: CanvasEnhancementParams,
  ) => CanvasEnhancementResult;
}

// ---------------------------------------------------------------------------
// Canvas enhancement types used by useCanvasEnhancements composing hook
// ---------------------------------------------------------------------------

export interface CanvasEnhancementParams {
  spec: ComponentSpec | null;
  nodes: Node[];
  edges: Edge[];
  metaKeyPressed: boolean;
  isConnecting: boolean;
}

export interface CanvasEnhancementResult {
  extraNodes?: Node[];
  extraEdges?: Edge[];
  /** Replaces the incoming edges (used for styling / type transforms). */
  transformedEdges?: Edge[];
  onEdgeClick?: (event: MouseEvent, edge: { id: string }) => void;
}
