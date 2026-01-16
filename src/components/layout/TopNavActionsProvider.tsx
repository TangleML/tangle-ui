import { type ReactNode, useId, useLayoutEffect, useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";

type ActionEntry = {
  id: string;
  node: ReactNode;
  priority?: number;
};

type TopNavActionsContextValue = {
  actions: ActionEntry[];
  registerAction: (id: string, node: ReactNode, priority?: number) => void;
  unregisterAction: (id: string) => void;
};

const TopNavActionsContext = createRequiredContext<TopNavActionsContextValue>(
  "TopNavActionsContext",
);

export const TopNavActionsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [actions, setActions] = useState<ActionEntry[]>([]);

  const registerAction = (id: string, node: ReactNode, priority = 0) => {
    setActions((prev) => {
      const filtered = prev.filter((a) => a.id !== id);
      const newActions = [...filtered, { id, node, priority }];
      return newActions.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    });
  };

  const unregisterAction = (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  const value = { actions, registerAction, unregisterAction };

  return (
    <TopNavActionsContext.Provider value={value}>
      {children}
    </TopNavActionsContext.Provider>
  );
};

const useTopNavActions = () => useRequiredContext(TopNavActionsContext);

/**
 * Hook to register an action in the top nav.
 * The action will be automatically unregistered when the component unmounts.
 */
export const useRegisterTopNavAction = (
  node: ReactNode,
  options?: { priority?: number },
) => {
  const id = useId();
  const { registerAction, unregisterAction } = useTopNavActions();

  useLayoutEffect(() => {
    registerAction(id, node, options?.priority);
    return () => unregisterAction(id);
  }, [id, node, options?.priority, registerAction, unregisterAction]);
};

/**
 * Renders all registered top nav actions.
 * Can be placed in multiple locations (desktop menu, mobile drawer, etc.)
 */
export const TopNavActionsRenderer = () => {
  const { actions } = useTopNavActions();

  if (actions.length === 0) {
    return null;
  }

  return (
    <>
      {actions.map((action) => (
        <ActionWrapper key={action.id}>{action.node}</ActionWrapper>
      ))}
    </>
  );
};

function ActionWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
