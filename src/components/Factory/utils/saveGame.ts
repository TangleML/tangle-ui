import type { Edge, Node } from "@xyflow/react";
import localforage from "localforage";

import type { GlobalResources } from "../data/resources";
import type { DayStatistics } from "../types/statistics";

const factoryGameStore = localforage.createInstance({
  name: "tangle-factory",
  storeName: "game_saves",
  description: "Store for Factory Game save data",
});

export interface GameSaveData {
  version: string;
  savedAt: number;
  day: number;
  nodes: Node[];
  edges: Edge[];
  globalResources: GlobalResources;
  statisticsHistory: DayStatistics[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

const SAVE_KEY = "autosave";
const CURRENT_VERSION = "1.0.0";

/**
 * Serialize and save the current game state to IndexedDB
 */
export async function saveGameState(
  nodes: Node[],
  edges: Edge[],
  globalResources: GlobalResources,
  statisticsHistory: DayStatistics[],
  viewport?: { x: number; y: number; zoom: number },
): Promise<void> {
  const saveData: GameSaveData = {
    version: CURRENT_VERSION,
    savedAt: Date.now(),
    day:
      statisticsHistory.length > 0
        ? statisticsHistory[statisticsHistory.length - 1].global.day
        : 0,
    nodes: serializeNodes(nodes),
    edges: serializeEdges(edges),
    globalResources: { ...globalResources },
    statisticsHistory: serializeStatistics(statisticsHistory),
    viewport,
  };

  await factoryGameStore.setItem(SAVE_KEY, saveData);
}

/**
 * Load the game state from IndexedDB
 */
export async function loadGameState(): Promise<GameSaveData | null> {
  try {
    const saveData = await factoryGameStore.getItem<GameSaveData>(SAVE_KEY);

    if (!saveData) {
      return null;
    }

    // Deserialize the statistics history to restore Maps
    const deserializedSaveData: GameSaveData = {
      ...saveData,
      statisticsHistory: deserializeStatistics(saveData.statisticsHistory),
      nodes: saveData.nodes.map(deserializeNode),
      edges: saveData.edges.map(deserializeEdge),
    };

    return deserializedSaveData;
  } catch (error) {
    console.error("Error loading game state:", error);
    return null;
  }
}

/**
 * Check if a save exists
 */
export async function hasSaveData(): Promise<boolean> {
  const saveData = await factoryGameStore.getItem<GameSaveData>(SAVE_KEY);
  return saveData !== null;
}

/**
 * Delete the save data
 */
export async function deleteSaveData(): Promise<void> {
  await factoryGameStore.removeItem(SAVE_KEY);
}

/**
 * Get save metadata without loading full data
 */
export async function getSaveMetadata(): Promise<{
  day: number;
  savedAt: number;
  version: string;
} | null> {
  const saveData = await factoryGameStore.getItem<GameSaveData>(SAVE_KEY);

  if (!saveData) return null;

  return {
    day: saveData.day,
    savedAt: saveData.savedAt,
    version: saveData.version,
  };
}

/**
 * Serialize nodes for storage (remove functions, clean data)
 */
function serializeNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      buildingInstance: node.data.buildingInstance
        ? serializeBuildingInstance(node.data.buildingInstance)
        : undefined,
    },
  }));
}

/**
 * Deserialize a node, restoring Map objects in building instances
 */
function deserializeNode(node: Node): Node {
  return {
    ...node,
    data: {
      ...node.data,
      buildingInstance: node.data.buildingInstance
        ? deserializeBuildingInstance(node.data.buildingInstance)
        : undefined,
    },
  };
}

/**
 * Serialize building instance, converting Maps to objects with markers
 */
function serializeBuildingInstance(instance: any): any {
  return {
    ...instance,
    stockpile: instance.stockpile?.map((stock: any) => ({
      ...stock,
      breakdown: stock.breakdown ? serializeValue(stock.breakdown) : undefined,
    })),
  };
}

/**
 * Deserialize building instance, restoring Map in stockpile breakdown
 */
function deserializeBuildingInstance(instance: any): any {
  return {
    ...instance,
    stockpile: instance.stockpile?.map((stock: any) => {
      const deserialized: any = {
        ...stock,
      };

      if (stock.breakdown) {
        deserialized.breakdown = deserializeValue(stock.breakdown);
      }

      return deserialized;
    }),
  };
}

/**
 * Serialize edges for storage
 */
function serializeEdges(edges: Edge[]): Edge[] {
  return edges.map((edge) => ({
    ...edge,
    data: {
      ...edge.data,
    },
  }));
}

/**
 * Deserialize an edge, restoring any complex data structures
 */
function deserializeEdge(edge: Edge): Edge {
  return {
    ...edge,
    data: edge.data ? deserializeValue(edge.data) : undefined,
  };
}

/**
 * Serialize statistics history
 * Note: Maps need to be converted to objects for JSON serialization
 */
function serializeStatistics(history: DayStatistics[]): DayStatistics[] {
  return history.map((dayStat) => ({
    ...dayStat,
    buildings: mapToObject(dayStat.buildings),
    edges: mapToObject(dayStat.edges),
  })) as any;
}

/**
 * Deserialize statistics history
 * Convert objects back to Maps
 */
export function deserializeStatistics(serialized: any[]): DayStatistics[] {
  return serialized.map((dayStat) => ({
    ...dayStat,
    buildings: objectToMap(dayStat.buildings),
    edges: objectToMap(dayStat.edges),
  }));
}

/**
 * Convert Map to plain object for JSON serialization
 */
function mapToObject<V>(map: Map<string, V>): Record<string, V> {
  const obj: Record<string, V> = {};

  map.forEach((value, key) => {
    obj[key] = serializeValue(value);
  });

  return obj;
}

/**
 * Convert plain object back to Map
 */
function objectToMap<V>(obj: Record<string, V>): Map<string, V> {
  const map = new Map<string, V>();

  Object.entries(obj).forEach(([key, value]) => {
    map.set(key, deserializeValue(value) as V);
  });

  return map;
}

/**
 * Recursively serialize values that might contain Maps
 */
function serializeValue(value: any): any {
  if (value instanceof Map) {
    return {
      __isMap: true,
      data: mapToObject(value),
    };
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (value && typeof value === "object") {
    const serialized: any = {};
    Object.entries(value).forEach(([k, v]) => {
      serialized[k] = serializeValue(v);
    });
    return serialized;
  }

  return value;
}

/**
 * Recursively deserialize values that might have been Maps
 */
function deserializeValue(value: any): any {
  if (value && typeof value === "object" && value.__isMap) {
    const deserializedData = objectToMap(value.data);
    return deserializedData;
  }

  if (Array.isArray(value)) {
    return value.map(deserializeValue);
  }

  if (value && typeof value === "object") {
    const deserialized: any = {};
    Object.entries(value).forEach(([k, v]) => {
      deserialized[k] = deserializeValue(v);
    });
    return deserialized;
  }

  return value;
}
