import type { Edge, Node } from "@xyflow/react";
import { useState } from "react";

import { isBuildingData, type Stockpile } from "../types/buildings";
import type { GameState } from "../types/game";

export const useGameState = (initialNodes: Node[], initialEdges: Edge[]) => {
  const [gameState, setGameState] = useState<GameState>({
    day: 0,
    nodes: initialNodes,
    edges: initialEdges,
  });

  const advanceDay = () => {
    setGameState((prev) => ({
      ...prev,
      day: prev.day + 1,
    }));
  };

  const updateNodeStockpile = (
    nodeId: string,
    resource: string,
    amount: number,
  ) => {
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
  };

  return {
    gameState,
    advanceDay,
    updateNodeStockpile,
  };
};
