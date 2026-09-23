import { createContext, type ReactNode, useContext, useRef } from "react";

interface QuickRunSubmitterApi {
  registerSubmitter: (node: HTMLElement | null) => void;
  submitRun: () => void;
  submitWithArguments: () => void;
}

const QuickRunSubmitterContext = createContext<QuickRunSubmitterApi | null>(
  null,
);

/**
 * Scopes the hidden `TangleSubmitter` to one editor. The workarea mounts an
 * editor per tab, so a `document`-wide lookup would find whichever submitter
 * comes first and run the wrong pipeline. Several Quick Run controls share one
 * submitter — the menu bar button renders it while the dock's mini button and
 * the Runs menu drive it — so the element is registered here rather than held
 * in a ref beside any one of them.
 */
export function QuickRunSubmitterProvider({
  children,
}: {
  children: ReactNode;
}) {
  const submitterRef = useRef<HTMLElement | null>(null);

  function click(selector: string) {
    submitterRef.current?.querySelector<HTMLButtonElement>(selector)?.click();
  }

  const api: QuickRunSubmitterApi = {
    registerSubmitter: (node) => {
      submitterRef.current = node;
    },
    submitRun: () => click("button:first-of-type"),
    submitWithArguments: () =>
      click('[data-testid="run-with-arguments-button"]'),
  };

  return (
    <QuickRunSubmitterContext.Provider value={api}>
      {children}
    </QuickRunSubmitterContext.Provider>
  );
}

export function useQuickRunSubmitter(): QuickRunSubmitterApi {
  const api = useContext(QuickRunSubmitterContext);
  if (!api) {
    throw new Error(
      "useQuickRunSubmitter must be used within a QuickRunSubmitterProvider",
    );
  }
  return api;
}
