import { type Node } from "@xyflow/react";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { createStringList, truncate } from "@/utils/string";

import { isFlexNode, type NodesAndEdges } from "../types";
import { thisCannotBeUndone } from "./shared";

export function getDeleteConfirmationDetails(deletedElements: NodesAndEdges) {
  const deletedNodes = deletedElements.nodes;
  const deletedEdges = deletedElements.edges;

  if (deletedNodes.length > 0) {
    const isDeletingMultipleNodes = deletedNodes.length > 1;

    if (!isDeletingMultipleNodes) {
      const node = deletedNodes[0];

      if (isFlexNode(node)) {
        const singleDeleteTitle = `Delete Sticky Note?`;
        const singleDeleteDesc = node.data.properties.title
          ? `Title: '${node.data.properties.title}'`
          : node.data.properties.content
            ? `Content: '${truncate(node.data.properties.content, 12, { breakWords: false })}'`
            : "This sticky note has no text content";

        return {
          title: singleDeleteTitle,
          description: singleDeleteDesc,
        };
      }

      const singleDeleteTitle =
        "Delete Node" +
        (deletedNodes.length > 0 ? ` '${deletedNodes[0].id}'` : "") +
        "?";

      const singleDeleteDesc = (
        <BlockStack>
          <Text size="sm">
            This will also delete all connections to and from the Node.
          </Text>
          {thisCannotBeUndone}
        </BlockStack>
      );

      return {
        title: singleDeleteTitle,
        content: singleDeleteDesc,
        description: "",
      };
    }

    const sortedDeletedNodes = sortFlexNodesLast(deletedNodes);

    const multiDeleteTitle = `Delete Nodes?`;

    const deletedNodeList = createStringList(
      getNodeIdsForDisplay(sortedDeletedNodes),
      2,
      "node",
    );

    if (sortedDeletedNodes.every(isFlexNode)) {
      const multiDeleteDesc = (
        <BlockStack>
          <Text size="sm">{`This will delete ${deletedNodeList}.`}</Text>
          <br />
          {thisCannotBeUndone}
        </BlockStack>
      );

      return {
        title: multiDeleteTitle,
        content: multiDeleteDesc,
        description: "",
      };
    }

    const multiDeleteDesc = (
      <BlockStack>
        <Text size="sm">{`Deleting ${deletedNodeList} will also remove all connections to and from these nodes.`}</Text>
        <br />
        {thisCannotBeUndone}
      </BlockStack>
    );

    return {
      title: multiDeleteTitle,
      content: multiDeleteDesc,
      description: "",
    };
  }

  if (deletedEdges.length > 0) {
    const isDeletingMultipleEdges = deletedEdges.length > 1;

    const edgeDeleteTitle = isDeletingMultipleEdges
      ? "Delete Connections?"
      : "Delete Connection?";

    const edgeDeleteDesc = (
      <BlockStack>
        <Text size="sm">
          This will remove the follow connections between task nodes:
        </Text>
        <Text size="sm">
          {deletedEdges
            .map((edge) => {
              return `'${edge.id}'`;
            })
            .join(", ")}
        </Text>
        <br />
        {thisCannotBeUndone}
      </BlockStack>
    );

    return {
      title: edgeDeleteTitle,
      content: edgeDeleteDesc,
      description: "",
    };
  }

  // Fallback to default
  return {};
}

function getNodeIdsForDisplay(nodes: Node[]) {
  return nodes.map((node) => {
    if (isFlexNode(node)) {
      const textContent =
        node.data.properties.title ||
        truncate(node.data.properties.content, 12, { breakWords: false });

      return `'${textContent.length ? textContent : "untitled"}' (Sticky Note)`;
    }

    return node.id;
  });
}

function sortFlexNodesLast(nodes: Node[]) {
  return [...nodes].sort((a, b) => {
    const aIsFlex = isFlexNode(a);
    const bIsFlex = isFlexNode(b);

    if (aIsFlex && !bIsFlex) return 1;
    if (!aIsFlex && bIsFlex) return -1;

    return 0;
  });
}
