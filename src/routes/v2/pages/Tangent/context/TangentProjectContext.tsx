import { useTangent } from "@tangent/embed-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import useToastNotification from "@/hooks/useToastNotification";
import { TANGENT_BUNDLE_ID } from "@/routes/v2/pages/Tangent/constants";
import {
  type ProjectSession,
  useProjectSessions,
} from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import { useTangentSessionTabs } from "@/routes/v2/pages/Tangent/hooks/useTangentSessionTabs";
import { resolveWorkareaTarget } from "@/routes/v2/pages/Tangent/services/resolveWorkareaTarget";
import type { WorkareaTab } from "@/routes/v2/pages/Tangent/workarea/types";
import type { Project } from "@/services/projects/types";
import { useProject } from "@/services/projects/useProjects";
import { getErrorMessage } from "@/utils/string";

type SessionTabs = ReturnType<typeof useTangentSessionTabs>;

interface TangentProjectContextValue {
  projectId: string;
  project: Project | undefined;
  sessions: ProjectSession[];
  activeSessionId: string | undefined;
  isStartingSession: boolean;
  selectSession: (sessionId: string) => void;
  startSession: () => void;
  recordSessionPrompt: (content: string) => void;
  tabs: SessionTabs;
  workareaTabs: WorkareaTab[];
  activeWorkareaTabId: string | null;
  openWorkareaTarget: (target: string, title?: string) => WorkareaTab;
  selectWorkareaTab: (id: string) => void;
  closeWorkareaTab: (id: string) => void;
  onOpenArtifact: (url: string, title: string) => void;
  onError: (message: string) => void;
}

const TangentProjectCtx = createRequiredContext<TangentProjectContextValue>(
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
  const { data: project } = useProject(projectId);
  const { sessions, attachSession, detachSession } =
    useProjectSessions(projectId);
  const tabs = useTangentSessionTabs();
  const [selectedSessionId, setSelectedSessionId] = useState<
    string | undefined
  >();
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [workareaTabs, setWorkareaTabs] = useState<WorkareaTab[]>([]);
  const [activeWorkareaTabId, setActiveWorkareaTabId] = useState<string | null>(
    null,
  );

  // The selected session wins while it exists; otherwise fall back to the most
  // recent attached session (the list is newest-first).
  const activeSessionId = selectedSessionId ?? sessions[0]?.sessionId;

  // Sessions started this mount, mapped to their resource id, so a never-used
  // one can be detached + deleted on switch/unmount. Only sessions started here
  // are eligible — pre-existing attached sessions are never auto-discarded.
  const freshSessionsRef = useRef(new Map<string, string>());
  const sessionsWithPromptRef = useRef(new Set<string>());
  const activeSessionIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const { resetTabs } = tabs;
  useEffect(() => {
    resetTabs();
    setWorkareaTabs([]);
    setActiveWorkareaTabId(null);
  }, [activeSessionId, resetTabs]);

  async function discardEmptySession(sessionId: string | undefined) {
    if (!sessionId) return;
    const resourceId = freshSessionsRef.current.get(sessionId);
    if (!resourceId) return;
    if (sessionsWithPromptRef.current.has(sessionId)) return;
    freshSessionsRef.current.delete(sessionId);
    try {
      await detachSession(resourceId);
    } catch (error) {
      notify(getErrorMessage(error), "error");
    }
  }

  // Keep a ref to the latest `discardEmptySession` so the unmount-only cleanup
  // (empty deps) runs current logic without re-subscribing every render.
  const discardEmptySessionRef = useRef(discardEmptySession);
  useEffect(() => {
    discardEmptySessionRef.current = discardEmptySession;
  });
  useEffect(
    () => () => {
      void discardEmptySessionRef.current(activeSessionIdRef.current);
    },
    [],
  );

  async function startSession() {
    if (isStartingSession) return;
    const previous = activeSessionIdRef.current;
    setIsStartingSession(true);
    try {
      // Empty prompt: the embed skips the opening turn so the human types the
      // first message. `name` labels the session in Tangent's own session list.
      const { sessionId } = await newSession("", TANGENT_BUNDLE_ID, {
        name: "New Tangent session",
      });
      const resource = await attachSession(sessionId);
      freshSessionsRef.current.set(sessionId, resource.id);
      setSelectedSessionId(sessionId);
      if (previous && previous !== sessionId) {
        await discardEmptySession(previous);
      }
    } catch (error) {
      notify(getErrorMessage(error), "error");
    } finally {
      setIsStartingSession(false);
    }
  }

  function selectSession(sessionId: string) {
    const previous = activeSessionIdRef.current;
    setSelectedSessionId(sessionId);
    if (previous && previous !== sessionId) {
      void discardEmptySession(previous);
    }
  }

  function recordSessionPrompt(content: string) {
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) return;
    if (!content.trim()) return;
    sessionsWithPromptRef.current.add(sessionId);
  }

  function openArtifactTab(url: string, title: string): WorkareaTab {
    const existing = workareaTabs.find(
      (tab) => tab.kind === "artifact" && tab.url === url,
    );
    if (existing) {
      setActiveWorkareaTabId(existing.id);
      return existing;
    }
    const tab: WorkareaTab = {
      id: crypto.randomUUID(),
      kind: "artifact",
      title,
      url,
    };
    setWorkareaTabs((prev) => [...prev, tab]);
    setActiveWorkareaTabId(tab.id);
    return tab;
  }

  // String-target entry point (`pipeline://`, run refs, …) for opening the
  // workarea from chat/agents. Only `http(s)` artifacts resolve today; the
  // remaining kinds — and the callers that pass them — land with later PRs.
  function openWorkareaTarget(target: string, title?: string): WorkareaTab {
    const view = resolveWorkareaTarget(target, { title });
    return openArtifactTab(view.url, view.title);
  }

  function selectWorkareaTab(id: string) {
    setActiveWorkareaTabId(id);
  }

  function closeWorkareaTab(id: string) {
    const next = workareaTabs.filter((tab) => tab.id !== id);
    setWorkareaTabs(next);
    if (activeWorkareaTabId === id) {
      setActiveWorkareaTabId(next.length > 0 ? next[next.length - 1].id : null);
    }
  }

  function onError(message: string) {
    notify(message, "error");
  }

  const value: TangentProjectContextValue = {
    projectId,
    project,
    sessions,
    activeSessionId,
    isStartingSession,
    selectSession,
    startSession,
    recordSessionPrompt,
    tabs,
    workareaTabs,
    activeWorkareaTabId,
    openWorkareaTarget,
    selectWorkareaTab,
    closeWorkareaTab,
    onOpenArtifact: openArtifactTab,
    onError,
  };

  return (
    <TangentProjectCtx.Provider value={value}>
      {children}
    </TangentProjectCtx.Provider>
  );
}

export function useTangentProject(): TangentProjectContextValue {
  return useRequiredContext(TangentProjectCtx);
}
