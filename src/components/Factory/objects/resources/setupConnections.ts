import type { Edge, Node, ReactFlowInstance } from "@xyflow/react";

import type { BuildingSetup, ConnectionSetup } from "../../data/setup";
import { getBuildingInstance } from "../../types/buildings";
import type { ResourceType } from "../../types/resources";
import { createResourceEdge } from "./createResourceEdge";

/**
 * Creates edges from setup connections, mapping setupIds to actual node IDs
 * and validating/inferring resource types.
 */
export const setupConnections = (
  connections: ConnectionSetup[],
  buildings: BuildingSetup[],
  nodes: Node[],
  reactFlowInstance: ReactFlowInstance,
): Edge[] => {
  const edges = connections
    .map((connection) => {
      // Step 1: Map Setup Id to actual Node Id
      const sourceIdIndex = buildings.findIndex(
        (b) => b.setupId === connection.source,
      );
      const targetIdIndex = buildings.findIndex(
        (b) => b.setupId === connection.target,
      );

      if (sourceIdIndex === -1 || targetIdIndex === -1) {
        console.warn(
          `Connection references unknown building: ${connection.source} or ${connection.target}`,
        );
        return null;
      }

      const sourceNode = nodes[sourceIdIndex];
      const targetNode = nodes[targetIdIndex];

      if (!sourceNode || !targetNode) {
        console.warn(
          `Could not find nodes for connection: ${connection.source} or ${connection.target}`,
        );
        return null;
      }

      // Step 2: Determine & verify resource type for the connection
      const result = determineConnectionResource(
        sourceNode,
        targetNode,
        connection.resource,
      );

      if (!result) {
        return null;
      }

      return createResourceEdge(
        result.sourceId,
        result.targetId,
        result.resource,
        reactFlowInstance,
      );
    })
    .filter((edge): edge is Edge => edge !== null);

  return edges;
};

/**
 * Determines the resource type and correct direction for a connection between two nodes.
 * Returns null if no valid connection can be made.
 */
function determineConnectionResource(
  sourceNode: Node,
  targetNode: Node,
  specifiedResource?: ResourceType,
): {
  sourceId: string;
  targetId: string;
  resource: ResourceType;
} | null {
  const sourceBuildingInstance = getBuildingInstance(sourceNode);
  const targetBuildingInstance = getBuildingInstance(targetNode);

  if (!sourceBuildingInstance || !targetBuildingInstance) {
    console.warn("Could not get building instances");
    return null;
  }

  let finalSourceId = sourceNode.id;
  let finalTargetId = targetNode.id;
  let finalResource = specifiedResource;

  // If resource was specified, validate it
  if (specifiedResource) {
    const sourceHasOutput = sourceBuildingInstance.outputs.some(
      (output) =>
        output.resource === specifiedResource || output.resource === "any",
    );
    const targetHasInput = targetBuildingInstance.inputs.some(
      (input) =>
        input.resource === specifiedResource || input.resource === "any",
    );

    if (sourceHasOutput && targetHasInput) {
      // Valid as-is
      return {
        sourceId: finalSourceId,
        targetId: finalTargetId,
        resource: specifiedResource,
      };
    }

    // Try swapping direction
    const sourceHasInput = sourceBuildingInstance.inputs.some(
      (input) =>
        input.resource === specifiedResource || input.resource === "any",
    );
    const targetHasOutput = targetBuildingInstance.outputs.some(
      (output) =>
        output.resource === specifiedResource || output.resource === "any",
    );

    if (sourceHasInput && targetHasOutput) {
      // Swap direction
      return {
        sourceId: targetNode.id,
        targetId: sourceNode.id,
        resource: specifiedResource,
      };
    }

    console.warn(
      `Invalid resource type ${specifiedResource} for connection between ${sourceNode.data?.name} and ${targetNode.data?.name}`,
    );
    return null;
  }

  // No resource specified - try to infer it

  // Check if any source output matches target input
  for (const output of sourceBuildingInstance.outputs) {
    if (
      targetBuildingInstance.inputs.some(
        (input) =>
          input.resource === output.resource || input.resource === "any",
      )
    ) {
      finalResource = output.resource;
      break;
    }
  }

  if (finalResource) {
    return {
      sourceId: finalSourceId,
      targetId: finalTargetId,
      resource: finalResource,
    };
  }

  // Try reversed - check if source input matches target output
  for (const input of sourceBuildingInstance.inputs) {
    if (
      targetBuildingInstance.outputs.some(
        (output) =>
          output.resource === input.resource || output.resource === "any",
      )
    ) {
      finalResource = input.resource;
      finalSourceId = targetNode.id;
      finalTargetId = sourceNode.id;
      break;
    }
  }

  if (finalResource) {
    return {
      sourceId: finalSourceId,
      targetId: finalTargetId,
      resource: finalResource,
    };
  }

  console.warn(
    `Could not determine resource type for connection between ${sourceNode.data?.name} and ${targetNode.data?.name}`,
  );
  return null;
}
