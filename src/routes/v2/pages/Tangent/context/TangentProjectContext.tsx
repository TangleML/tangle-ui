import { useTangent } from "@tangent/embed-react";
import { type ReactNode, useEffect, useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import useToastNotification from "@/hooks/useToastNotification";
import { useProjectSessions } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";

const TangentProjectCtx = createRequiredContext<TangentProjectStore>(
  "TangentProjectContext",
);

interface TangentProjectProviderProps {
  projectId: string;
  children: ReactNode;
}

export function TangentProjectProvider({
  projectId,
  children,
}: TangentProjectProviderProps) {
  const notify = useToastNotification();
  const { newSession } = useTangent();
  const { sessions, attachSession, detachSession } =
    useProjectSessions(projectId);
  const [store] = useState(() => new TangentProjectStore(projectId));

  useEffect(() => {
    store.setSessionIo({ newSession, attachSession, detachSession, notify });
  }, [store, newSession, attachSession, detachSession, notify]);

  const defaultSessionId = sessions[0]?.sessionId;
  useEffect(() => {
    store.setDefaultSessionId(defaultSessionId);
  }, [store, defaultSessionId]);

  useEffect(
    () => () => {
      void store.discardActiveSessionOnUnmount();
    },
    [store],
  );

  return (
    <TangentProjectCtx.Provider value={store}>
      {children}
    </TangentProjectCtx.Provider>
  );
}

export function useTangentProject(): TangentProjectStore {
  return useRequiredContext(TangentProjectCtx);
}
