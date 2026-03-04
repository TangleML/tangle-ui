import { useEffect } from "react";

import { useComponentSpecStore } from "@/stores/componentSpecStore";

/**
 * Hook to handle keyboard navigation for subgraphs
 * - Escape: Navigate back to parent subgraph
 */
export const useSubgraphKeyboardNavigation = () => {
  const canNavigateBack = useComponentSpecStore(
    (s) => s.currentSubgraphPath.length > 1,
  );
  const navigateBack = useComponentSpecStore((s) => s.navigateBack);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!canNavigateBack) return;

      // Don't interfere with typing in input fields, textareas, or contenteditable elements
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        navigateBack();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [canNavigateBack, navigateBack]);
};
