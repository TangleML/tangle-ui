interface SelectedHandle {
  nodeId: string;
  handleId: string;
  handleType: "input" | "output";
}

// Global state - single source of truth
let globalSelectedHandle: SelectedHandle | null = null;

// Listeners for handle highlighting changes
const handleHighlightListeners = new Set<() => void>();

// Listeners for edge highlighting changes
const edgeHighlightListeners = new Set<() => void>();

const notifyHandleListeners = () => {
  handleHighlightListeners.forEach((listener) => listener());
};

const notifyEdgeListeners = () => {
  edgeHighlightListeners.forEach((listener) => listener());
};

// Public API
export const highlightConnections = (
  nodeId: string,
  handleId: string,
  handleType: "input" | "output",
) => {
  globalSelectedHandle = { nodeId, handleId, handleType };
  notifyHandleListeners();
  notifyEdgeListeners();
};

export const clearHighlights = () => {
  globalSelectedHandle = null;
  notifyHandleListeners();
  notifyEdgeListeners();
};

export const getSelectedHandle = () => globalSelectedHandle;

// Subscription functions
export const subscribeToHandleHighlights = (listener: () => void) => {
  handleHighlightListeners.add(listener);
  return () => {
    handleHighlightListeners.delete(listener);
  };
};

export const subscribeToEdgeHighlights = (listener: () => void) => {
  edgeHighlightListeners.add(listener);
  return () => {
    edgeHighlightListeners.delete(listener);
  };
};
