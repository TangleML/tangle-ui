import { useEffect, useState } from "react";

import type { ConfirmPayload, ConfirmResult } from "@/config/preSubmitHooks";

import { ConfirmDialogContent } from "./ConfirmDialogContent";

interface ActiveDialog {
  payload: ConfirmPayload;
  resolve: (result: ConfirmResult) => void;
}

export function ConfirmDialogBridge() {
  const [active, setActive] = useState<ActiveDialog | null>(null);

  useEffect(() => {
    const confirm = (payload: ConfirmPayload) =>
      new Promise<ConfirmResult>((resolve) => {
        setActive({ payload, resolve });
      });

    window.__TANGLE_CONFIRM__ = confirm;

    return () => {
      if (window.__TANGLE_CONFIRM__ === confirm) {
        delete window.__TANGLE_CONFIRM__;
      }
    };
  }, []);

  if (!active) {
    return null;
  }

  const handleResolve = (result: ConfirmResult) => {
    active.resolve(result);
    setActive(null);
  };

  return (
    <ConfirmDialogContent payload={active.payload} onResolve={handleResolve} />
  );
}
