import type { Edge, EdgeTypes, Node, NodeTypes } from "@xyflow/react";

import type { ComponentSpec } from "@/models/componentSpec";

import { buildBindingEdges } from "./buildUtils";
import type { NodeTypeManifest } from "./types";

/**
 * Central registry of node-type plugins.
 *
 * FlowCanvas and store actions look up manifests here instead of using
 * if/else chains on node ID prefixes or RF node types.
 */
export class NodeTypeRegistry {
  private byEntityType = new Map<string, NodeTypeManifest>();

  /**
   * Sorted longest-prefix-first so a longer prefix always wins
   * (e.g. "conduit_edge_" would beat "conduit_" if it existed).
   */
  private prefixes: Array<{ prefix: string; manifest: NodeTypeManifest }> = [];

  private cachedNodeTypes: NodeTypes | null = null;
  private cachedEdgeTypes: EdgeTypes | null = null;

  register(manifest: NodeTypeManifest): void {
    this.byEntityType.set(manifest.entityType, manifest);

    this.prefixes.push({ prefix: manifest.idPrefix, manifest });
    this.prefixes.sort((a, b) => b.prefix.length - a.prefix.length);

    this.cachedNodeTypes = null;
    this.cachedEdgeTypes = null;
  }

  /** Look up by domain entity type (e.g. "task", "input", "conduit"). */
  get(entityType: string): NodeTypeManifest | undefined {
    return this.byEntityType.get(entityType);
  }

  /** Derive the manifest from a node ID (replaces `getNodeTypeFromId`). */
  getByNodeId(
    spec: ComponentSpec | null,
    nodeId: string,
  ): NodeTypeManifest | undefined {
    for (const entry of this.prefixes) {
      if (nodeId.startsWith(entry.prefix)) return entry.manifest;
    }

    const candidates = !spec
      ? []
      : this.all().filter(
          (manifest) =>
            typeof manifest.hasEntityId === "function" &&
            manifest.hasEntityId(spec, nodeId),
        );
    if (candidates.length === 1) return candidates[0];

    return undefined;
  }

  /** All registered manifests (iteration order = registration order). */
  all(): NodeTypeManifest[] {
    return [...this.byEntityType.values()];
  }

  // -- Aggregated helpers used by FlowCanvas / hooks --------------------

  /** Build the `nodeTypes` record for `<ReactFlow nodeTypes={…}>`. */
  getNodeTypes(): NodeTypes {
    this.cachedNodeTypes ??= Object.fromEntries(
      this.all().map((m) => [m.type, m.component]),
    ) as NodeTypes;
    return this.cachedNodeTypes;
  }

  /** Build the `edgeTypes` record for `<ReactFlow edgeTypes={…}>`. */
  getEdgeTypes(): EdgeTypes {
    this.cachedEdgeTypes ??= Object.assign(
      {},
      ...this.all()
        .filter((m) => m.edgeTypes)
        .map((m) => m.edgeTypes),
    ) as EdgeTypes;
    return this.cachedEdgeTypes;
  }

  /** Aggregate `buildNodes` from every manifest. */
  buildAllNodes(spec: ComponentSpec): Node[] {
    return this.all().flatMap((manifest) => manifest.buildNodes(spec));
  }

  /**
   * Build all edges:
   * 1. Base binding edges (pure, no node-type knowledge)
   * 2. `transformEdges` from each manifest (e.g. conduit augmentation)
   * 3. Extra `buildEdges` from each manifest
   */
  buildAllEdges(spec: ComponentSpec): Edge[] {
    let edges = buildBindingEdges(spec);

    for (const manifest of this.all()) {
      if (manifest.transformEdges) {
        edges = manifest.transformEdges(spec, edges);
      }
    }

    const extraEdges = this.all()
      .filter((manifest) => manifest.buildEdges)
      .flatMap((manifest) => manifest.buildEdges!(spec));

    return [...edges, ...extraEdges];
  }
}
