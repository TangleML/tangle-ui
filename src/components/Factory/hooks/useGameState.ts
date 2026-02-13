import type { Edge, Node } from "@xyflow/react";
import { useCallback, useState } from "react";

import { isBuildingData, type Stockpile } from "../types/buildings";
import type { GameState } from "../types/game";

export const useGameState = (initialNodes: Node[], initialEdges: Edge[]) => {
  const [gameState, setGameState] = useState<GameState>({
    day: 0,
    globalResources: {
      coins: 0,
      knowledge: 0,
    },
    nodes: initialNodes,
    edges: initialEdges,
  });

  const advanceDay = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      day: prev.day + 1,
    }));
  }, []);

  const updateGlobalResource = useCallback(
    (resource: "coins" | "knowledge", amount: number) => {
      setGameState((prev) => ({
        ...prev,
        globalResources: {
          ...prev.globalResources,
          [resource]: prev.globalResources[resource] + amount,
        },
      }));
    },
    [],
  );

  const updateNodeStockpile = useCallback(
    (nodeId: string, resource: string, amount: number) => {
      setGameState((prev) => {
        const nodes = prev.nodes.map((node) => {
          if (node.id !== nodeId) return node;

          if (!isBuildingData(node.data)) {
            console.error("Node data is not a valid building:", node.data);
            return node;
          }

          const stockpile = node.data.stockpile || [];
          const updatedStockpile = stockpile.map((stock: Stockpile) => {
            if (stock.resource === resource) {
              return {
                ...stock,
                amount: Math.min(stock.maxAmount, stock.amount + amount),
              };
            }
            return stock;
          });

          return {
            ...node,
            data: {
              ...node.data,
              stockpile: updatedStockpile,
            },
          };
        });

        return { ...prev, nodes };
      });
    },
    [],
  );

  return {
    gameState,
    advanceDay,
    updateGlobalResource,
    updateNodeStockpile,
  };
};
