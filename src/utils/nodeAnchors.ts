export type NodePath = string[];

export const ROOT_NODE_ANCHOR = "node:root";

const sanitizeAnchorSegment = (segment: string): string => {
  return segment.replace(/[^a-zA-Z0-9_-]/g, "-");
};

export const buildNodeAnchor = (path: NodePath): string => {
  if (path.length === 0) {
    return ROOT_NODE_ANCHOR;
  }

  return `node:${path.map(sanitizeAnchorSegment).join(".")}`;
};

export const clonePath = (path: NodePath): NodePath => {
  return [...path];
};

