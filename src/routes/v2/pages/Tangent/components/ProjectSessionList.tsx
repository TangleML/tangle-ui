import { observer } from "mobx-react-lite";
import { useState } from "react";

import {
  RenameDialog,
  type RenameDialogProps,
} from "@/components/shared/Dialogs/RenameDialog";
import { Button } from "@/components/ui/button";
import { BlockStack } from "@/components/ui/layout";
import { ListItem, type ListItemFlair } from "@/components/ui/list-item";
import { Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { tangentSessionSearch } from "@/routes/tangentSearch";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useOpenTangentProject } from "@/routes/v2/pages/Tangent/hooks/useOpenTangentProject";
import {
  type ProjectSession,
  useProjectSessions,
} from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import type {
  SessionRunState,
  SessionRunStates,
} from "@/routes/v2/pages/Tangent/hooks/useSessionRunStates";
import { useOptionalWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { sessionLabelsById } from "@/services/projects/sessionLabel";
import { formatRelativeTime } from "@/utils/date";
import { tracking } from "@/utils/tracking";

const PREVIEW_COUNT = 5;

const RUN_STATE_LABEL: Record<SessionRunState, string> = {
  working: "Working",
  finished: "Finished",
  failed: "Last run failed",
};

/**
 * One project's sessions in the sidebar. A session of the project in view is
 * selected in place; one of another project opens that project with it. A
 * search lists every session it matched, and only those. A spinner marks a
 * session with an agent working, and a dot one whose run finished (green) or
 * failed (red) since it was last open.
 */
export const ProjectSessionList = observer(function ProjectSessionList({
  projectId,
  onlySessionIds,
  runStates,
}: {
  projectId: string;
  onlySessionIds?: ReadonlySet<string>;
  runStates: SessionRunStates;
}) {
  const store = useTangentProject();
  const openProject = useOpenTangentProject();
  const dismissFlyout = useOptionalWindowContext()?.dismissFlyout;
  const { sessions, renameSession } = useProjectSessions(projectId);
  const [showAll, setShowAll] = useState(false);
  const isProjectInView = projectId === store.projectId;
  const activeSessionId = isProjectInView ? store.activeSessionId : null;
  const labels = sessionLabelsById(
    sessions.map((session) => [session.sessionId, session]),
  );
  const labelFor = (sessionId: string) => labels.get(sessionId) ?? "";
  const { open } = useDialog();
  const notify = useToastNotification();
  const { track } = useAnalytics();

  async function rename(session: ProjectSession) {
    const name = await open<string, RenameDialogProps>({
      component: RenameDialog,
      props: {
        title: "Rename session",
        description: "Give this session a name of your own.",
        currentName: session.name ?? "",
        placeholder: labelFor(session.sessionId),
        trackingPrefix: "projects.rename_session",
      },
      routeKey: "rename-session",
    }).catch(convertCancelErrorTo(undefined));

    if (!name) return;

    try {
      await renameSession(session.resourceId, name);
      track("projects.rename_session_completed");
      notify("Session renamed", "success");
    } catch {
      // The resource mutation reports its own failure, so saying anything here
      // would be a second toast for one rename.
    }
  }

  function openSession(sessionId: string) {
    dismissFlyout?.();
    if (isProjectInView) {
      store.selectSession(sessionId);
      return;
    }
    void openProject(projectId, tangentSessionSearch(sessionId));
  }

  if (sessions.length === 0) {
    return (
      <Text size="xs" tone="subdued" className="block py-1 ps-8 pe-2">
        No sessions yet
      </Text>
    );
  }

  const listed = onlySessionIds
    ? sessions.filter((session) => onlySessionIds.has(session.sessionId))
    : sessions;
  const activeIndex = listed.findIndex(
    (session) => session.sessionId === activeSessionId,
  );
  const visible =
    onlySessionIds || showAll || activeIndex >= PREVIEW_COUNT
      ? listed
      : listed.slice(0, PREVIEW_COUNT);

  return (
    <BlockStack align="stretch">
      <BlockStack as="ul" align="stretch">
        {visible.map((session) => {
          const label = labelFor(session.sessionId);
          return (
            <SessionRow
              key={session.sessionId}
              label={label}
              createdAt={session.createdAt}
              runState={runStates.get(session.sessionId)}
              selected={session.sessionId === activeSessionId}
              onOpen={() => openSession(session.sessionId)}
              onRename={() => void rename(session)}
            />
          );
        })}
      </BlockStack>
      {visible.length < listed.length && (
        <Button
          variant="subtle"
          size="row"
          align="start"
          className="ps-8"
          onClick={() => setShowAll(true)}
          {...tracking("projects.sidebar.show_more_sessions")}
        >
          Show more
        </Button>
      )}
    </BlockStack>
  );
});

const RUN_STATE_FLAIR: Record<SessionRunState, ListItemFlair> = {
  working: { kind: "spinner", label: RUN_STATE_LABEL.working },
  finished: { kind: "dot", label: RUN_STATE_LABEL.finished, tone: "success" },
  failed: { kind: "dot", label: RUN_STATE_LABEL.failed, tone: "critical" },
};

/** A session reads as a line of text under its project, as a chat list does. */
function SessionRow({
  label,
  createdAt,
  runState,
  selected,
  onOpen,
  onRename,
}: {
  label: string;
  createdAt: Date;
  runState?: SessionRunState;
  selected: boolean;
  onOpen: () => void;
  onRename: () => void;
}) {
  return (
    <ListItem
      title={label}
      tooltip={[
        label,
        runState && RUN_STATE_LABEL[runState],
        formatRelativeTime(createdAt),
      ]
        .filter(Boolean)
        .join(" · ")}
      flair={runState && RUN_STATE_FLAIR[runState]}
      selected={selected}
      onOpen={onOpen}
      tracking={tracking("projects.open_session")}
      actions={[
        {
          icon: "Pencil",
          label: `Rename ${label}`,
          onClick: onRename,
          tracking: tracking("projects.rename_session_open"),
        },
      ]}
    />
  );
}
