import { type Node, type XYPosition } from "@xyflow/react";

import type { Comment, ComponentSpec } from "../componentSpec";

export function createCommentsFromComponentSpec(
  componentSpec: ComponentSpec,
): Node[] {
  const comments: Comment[] =
    componentSpec.metadata?.annotations?.comments || [];

  return comments.map(({ message, position, id }) =>
    createCommentNode(message, position, id),
  );
}

const createCommentNode = (
  message: string,
  position: XYPosition,
  id: string,
) => {
  return {
    id,
    data: {
      message,
    },
    position,
    connectable: false,
    type: "comment",
  } as Node;
};
