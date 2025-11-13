import { memo } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

interface GitHubAuthFlowBackdropProps {
  isOpen: boolean;
  onClose: () => void;
  onClick: () => void;
}

export const GitHubAuthFlowBackdrop = memo(function GitHubAuthFlowBackdrop({
  isOpen,
  onClose,
  onClick,
}: GitHubAuthFlowBackdropProps) {
  if (!isOpen) {
    return null;
  }

  const backdrop = (
    <div
      className="fixed inset-0 z-50 cursor-pointer bg-black/25 flex items-center justify-center"
      onClick={onClick}
    >
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg max-w-sm text-center">
        <h3 className="text-lg font-semibold mb-2">Tangle - Run pipeline</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          To run pipelines, please complete authentication in the popup window
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={onClose} variant="outline" size="sm">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(backdrop, document.body);
});
