import { useContext } from "react";

import { DialogContext } from "@/providers/DialogProvider/DialogContext";

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within DialogProvider");
  }

  return {
    open: context.open,
    close: context.close,
    cancel: context.cancel,
    closeAll: context.closeAll,
    stack: context.stack,
  };
}
