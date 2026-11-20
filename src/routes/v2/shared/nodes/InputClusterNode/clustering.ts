import type { ComponentSpec } from "@/models/componentSpec";

/** Minimum number of inputs required before a group is aggregated. */
const MIN_CLUSTER_SIZE = 2;

/** Node ID prefix identifying an aggregated input cluster node. */
export const INPUT_CLUSTER_ID_PREFIX = "inputcluster_";

export interface InputCluster {
  /** Deterministic id derived from the sorted member input ids. */
  id: string;
  /** Member input entity ids, kept in spec order for stable port ordering. */
  inputEntityIds: string[];
}

/**
 * Deterministic 32-bit string hash (djb2-xor). Used so a cluster keeps the same
 * id across renders and sessions as long as its membership is unchanged, which
 * lets us persist a per-cluster position keyed by that id.
 */
function stableHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Disjoint-set (union-find) over input ids with path compression. Kept local to
 * the clustering pass; no external identity semantics.
 */
class UnionFind {
  private parent = new Map<string, string>();

  add(id: string): void {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    let root = id;
    let parent = this.parent.get(root) ?? root;
    while (parent !== root) {
      root = parent;
      parent = this.parent.get(root) ?? root;
    }

    // Path compression: point every node on the walk directly at the root.
    let node = id;
    while (node !== root) {
      const next = this.parent.get(node) ?? root;
      this.parent.set(node, root);
      node = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }
}

/**
 * Groups pipeline inputs into clusters based on shared downstream usage.
 *
 * Two inputs join the same cluster when they feed a common consuming task; the
 * relation is transitive (connected components over the input↔task graph). Only
 * groups with at least {@link MIN_CLUSTER_SIZE} members are returned — singleton
 * and unused inputs stay as standalone input nodes.
 */
export function computeInputClusters(spec: ComponentSpec): InputCluster[] {
  const inputIds = new Set([...spec.inputs].map((input) => input.$id));
  if (inputIds.size === 0) return [];

  const unionFind = new UnionFind();
  for (const id of inputIds) unionFind.add(id);

  // Collect the input sources feeding each consuming task.
  const inputsByTask = new Map<string, string[]>();
  for (const binding of spec.bindings) {
    if (!inputIds.has(binding.sourceEntityId)) continue;
    const sources = inputsByTask.get(binding.targetEntityId) ?? [];
    sources.push(binding.sourceEntityId);
    inputsByTask.set(binding.targetEntityId, sources);
  }

  // Inputs feeding the same task belong to the same cluster.
  for (const [first, ...rest] of inputsByTask.values()) {
    if (first === undefined) continue;
    for (const other of rest) unionFind.union(first, other);
  }

  // Bucket inputs by their connected-component root, preserving spec order.
  const groups = new Map<string, string[]>();
  for (const input of spec.inputs) {
    const root = unionFind.find(input.$id);
    const members = groups.get(root) ?? [];
    members.push(input.$id);
    groups.set(root, members);
  }

  const clusters: InputCluster[] = [];
  for (const inputEntityIds of groups.values()) {
    if (inputEntityIds.length < MIN_CLUSTER_SIZE) continue;
    const clusterKey = [...inputEntityIds].sort().join("|");
    clusters.push({
      id: INPUT_CLUSTER_ID_PREFIX + stableHash(clusterKey),
      inputEntityIds,
    });
  }

  clusters.sort((a, b) => a.id.localeCompare(b.id));
  return clusters;
}
