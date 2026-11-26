import { Link } from "@tanstack/react-router";
import { observer } from "mobx-react-lite";
import { type ReactNode, useState } from "react";

import { CreateProjectDialog } from "@/components/Home/ProjectsSection/CreateProjectDialog";
import { ProjectMenu } from "@/components/Project/ProjectMenu";
import { useDeleteProjectAction } from "@/components/Project/useDeleteProjectAction";
import { useRenameProjectAction } from "@/components/Project/useRenameProjectAction";
import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ListItem } from "@/components/ui/list-item";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/routes/appRoutes";
import { newTangentSessionSearch } from "@/routes/tangentSearch";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useOpenGroups } from "@/routes/v2/pages/Tangent/hooks/useOpenGroups";
import {
  cancelPendingProjectMove,
  useOpenTangentProject,
} from "@/routes/v2/pages/Tangent/hooks/useOpenTangentProject";
import { useSessionsOfProjects } from "@/routes/v2/pages/Tangent/hooks/useProjectSessions";
import {
  type SessionRunStates,
  useSessionRunStates,
} from "@/routes/v2/pages/Tangent/hooks/useSessionRunStates";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import { useAiGate } from "@/routes/v2/shared/components/AiChat/components/useAiGate";
import { useOptionalWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { activeWorkspaces } from "@/services/projects/defaultWorkspace";
import type { ProjectSummary } from "@/services/projects/types";
import { usePinnedProjects } from "@/services/projects/usePinnedProjects";
import { useProject } from "@/services/projects/useProjects";
import { useReachableProjects } from "@/services/projects/useReachableProjects";
import { useWorkspaces } from "@/services/projects/useWorkspaces";
import { tracking } from "@/utils/tracking";

import { groupProjectsByWorkspace } from "./projectsByWorkspace";
import { ProjectSessionList } from "./ProjectSessionList";
import { searchProjects } from "./projectSidebarSearch";
import { SearchField } from "./SearchField";

const EXPANDED_PROJECTS_KEY = "tangent-sidebar-expanded-projects";
const EXPANDED_WORKSPACES_KEY = "tangent-sidebar-expanded-workspaces";

/**
 * Every project someone can get back to, each with its sessions, so moving
 * between projects is one click. Projects spread over more than one workspace
 * are gathered under their workspaces, each of which can be closed out of the
 * way. "New chat" starts in whichever project was clicked last, which is the
 * one in view until another is touched.
 *
 * A search opens each project with a matching session, and what is opened or
 * closed while searching is forgotten with the search, so it never changes
 * the remembered layout.
 */
export const ProjectsWindowContent = observer(function ProjectsWindowContent() {
  const store = useTangentProject();
  const openProject = useOpenTangentProject();
  const aiGate = useAiGate("New chat");
  const { projects: reachable } = useReachableProjects();
  const { projects: pinnedProjects } = usePinnedProjects();
  const { baseUrl } = useTangentBaseUrl(store.projectId);
  const runStates = useSessionRunStates(baseUrl, store.activeSessionId);
  const { data: projectInView } = useProject(store.projectId);
  const { data: workspaces } = useWorkspaces();
  const dismissFlyout = useOptionalWindowContext()?.dismissFlyout;
  const [targetProjectId, setTargetProjectId] = useState(store.projectId);
  const [projectIdInView, setProjectIdInView] = useState(store.projectId);
  const [query, setQuery] = useState("");
  const searching = query.trim() !== "";
  const openProjects = useOpenGroups(EXPANDED_PROJECTS_KEY, {
    defaultOpen: false,
    searching,
    initiallyOpen: store.projectId,
  });
  const openWorkspaces = useOpenGroups(EXPANDED_WORKSPACES_KEY, {
    defaultOpen: true,
    searching,
  });

  // This panel outlives a move to another project in place, so the project
  // arrived in becomes the target and is opened, as it is on a fresh mount.
  if (projectIdInView !== store.projectId) {
    setProjectIdInView(store.projectId);
    setTargetProjectId(store.projectId);
    openProjects.reveal(store.projectId);
  }

  // A shared project opened from a link is neither created nor pinned, but it
  // is the one being worked in, so it still belongs in the list.
  const projects: ProjectSummary[] =
    projectInView && !reachable.some(({ id }) => id === projectInView.id)
      ? [projectInView, ...reachable]
      : reachable;
  // A target deleted since it was clicked falls back to the project in view.
  const target =
    projects.find(({ id }) => id === targetProjectId) ??
    projects.find(({ id }) => id === store.projectId);
  const { sessionsByProject, isLoading: isLoadingSessions } =
    useSessionsOfProjects(
      projects.map(({ id }) => id),
      searching,
    );
  const matches = searching
    ? searchProjects(projects, sessionsByProject, query)
    : undefined;
  const matchingSessions = new Map(
    matches?.map(({ project, matchingSessionIds }) => [
      project.id,
      matchingSessionIds,
    ]),
  );
  const shown = matches?.map(({ project }) => project) ?? projects;
  const pinnedIds = new Set(pinnedProjects.map(({ id }) => id));
  const pinned = shown.filter(({ id }) => pinnedIds.has(id));
  const unpinned = shown.filter(({ id }) => !pinnedIds.has(id));
  // Counted over every project rather than the search's matches, so the
  // workspace headings don't come and go as a search is typed.
  const workspaceIds = new Set(
    projects
      .filter(({ id }) => !pinnedIds.has(id))
      .map(({ workspaceId }) => workspaceId),
  );
  const byWorkspace =
    workspaces && workspaceIds.size > 1
      ? groupProjectsByWorkspace(unpinned, workspaces)
      : undefined;

  function search(next: string) {
    setQuery(next);
    openProjects.forgetSearch();
    openWorkspaces.forgetSearch();
  }

  function setOpen(projectId: string, open: boolean) {
    setTargetProjectId(projectId);
    openProjects.setOpen(projectId, open);
  }

  function startChat() {
    dismissFlyout?.();
    if (!target || target.id === store.projectId) {
      cancelPendingProjectMove();
      void store.startSession();
      return;
    }
    void openProject(target.id, newTangentSessionSearch);
  }

  return (
    <BlockStack gap="2" align="stretch" className="p-2">
      <InlineStack gap="1" wrap="nowrap" className="w-full">
        <Button
          variant="ghost"
          className="min-w-0 flex-1 justify-start has-[>svg]:px-2"
          title={
            aiGate.disabled || !target
              ? aiGate.title
              : `New chat in ${target.name}`
          }
          disabled={store.isStartingSession || aiGate.disabled}
          onClick={startChat}
          {...tracking("projects.sidebar.new_chat")}
        >
          {store.isStartingSession ? (
            <Spinner size={16} className="text-current" />
          ) : (
            <Icon name="SquarePen" />
          )}
          New chat
        </Button>
        {workspaces && activeWorkspaces(workspaces).length > 0 && (
          <CreateProjectDialog
            workspaces={workspaces}
            trigger={
              <Button
                variant="subtle"
                size="icon-md"
                aria-label="New project"
                title="New project"
              >
                <Icon name="FolderPlus" size="sm" />
              </Button>
            }
          />
        )}
        <Button asChild variant="subtle" size="icon-md">
          <Link
            to={APP_ROUTES.PROJECTS}
            aria-label="All projects"
            title="All projects"
            {...tracking("projects.sidebar.all_projects")}
          >
            <Icon name="LayoutGrid" size="sm" />
          </Link>
        </Button>
      </InlineStack>

      <SearchField
        value={query}
        onChange={search}
        label="Search projects and sessions"
        trackingPrefix="projects.sidebar"
      />

      <BlockStack gap="3" align="stretch">
        {searching && shown.length === 0 && (
          <Text size="sm" tone="subdued" className="px-2 py-1">
            {isLoadingSessions
              ? "Searching…"
              : "No matching projects or sessions"}
          </Text>
        )}
        {pinned.length > 0 && (
          <ProjectSection title="Pinned">
            {pinned.map(renderGroup)}
          </ProjectSection>
        )}
        {byWorkspace
          ? byWorkspace.map((section) => (
              <WorkspaceSection
                key={section.workspaceId}
                title={section.title}
                open={openWorkspaces.isOpen(section.workspaceId, {
                  hasMatches: true,
                })}
                onOpenChange={(open) =>
                  openWorkspaces.setOpen(section.workspaceId, open)
                }
              >
                {section.projects.map(renderGroup)}
              </WorkspaceSection>
            ))
          : unpinned.length > 0 && (
              <ProjectSection
                title={pinned.length > 0 ? "Projects" : undefined}
              >
                {unpinned.map(renderGroup)}
              </ProjectSection>
            )}
      </BlockStack>
    </BlockStack>
  );

  function renderGroup(project: ProjectSummary) {
    const sessionIds = matchingSessions.get(project.id);
    const hasMatchingSessions = sessionIds !== undefined && sessionIds.size > 0;

    return (
      <ProjectGroup
        key={project.id}
        project={project}
        open={openProjects.isOpen(project.id, {
          hasMatches: hasMatchingSessions,
        })}
        inView={project.id === store.projectId}
        onlySessionIds={hasMatchingSessions ? sessionIds : undefined}
        runStates={runStates}
        onOpenChange={(next) => setOpen(project.id, next)}
      />
    );
  }
});

/** Without pins there is one list, which needs no heading under "Projects". */
function ProjectSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <BlockStack gap="1" align="stretch">
      {title && (
        <Text size="xs" weight="medium" tone="subdued" className="px-2">
          {title}
        </Text>
      )}
      <BlockStack as="ul" gap="1" align="stretch" aria-label={title}>
        {children}
      </BlockStack>
    </BlockStack>
  );
}

function WorkspaceSection({
  title,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Collapsible asChild open={open} onOpenChange={onOpenChange}>
      <BlockStack gap="1" align="stretch">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="row"
            align="start"
            fullWidth
            {...tracking("projects.sidebar.toggle_workspace")}
          >
            <Icon
              name={open ? "ChevronDown" : "ChevronRight"}
              size="sm"
              aria-hidden
              className="text-muted-foreground"
            />
            <Text
              size="xs"
              weight="medium"
              tone="subdued"
              title={title}
              className="min-w-0 flex-1 truncate"
            >
              {title}
            </Text>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <BlockStack as="ul" gap="1" align="stretch" aria-label={title}>
            {children}
          </BlockStack>
        </CollapsibleContent>
      </BlockStack>
    </Collapsible>
  );
}

function ProjectGroup({
  project,
  open,
  inView,
  onlySessionIds,
  runStates,
  onOpenChange,
}: {
  project: ProjectSummary;
  open: boolean;
  inView: boolean;
  onlySessionIds?: ReadonlySet<string>;
  runStates: SessionRunStates;
  onOpenChange: (open: boolean) => void;
}) {
  const rename = useRenameProjectAction(project);
  // Deleting the project in view leaves nothing to show here, so that one
  // goes back to the projects list; any other stays put.
  const { confirmAndDelete, isDeleting, confirmation } = useDeleteProjectAction(
    project,
    { navigateAfterDelete: inView },
  );

  return (
    <li className={cn(isDeleting && "pointer-events-none opacity-50")}>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <ListItem
          as="div"
          icon={open ? "FolderOpen" : "Folder"}
          title={project.name}
          expanded={open}
          onOpen={() => onOpenChange(!open)}
          tracking={tracking("projects.sidebar.toggle_project")}
          menu={
            <ProjectMenu
              project={project}
              onRename={() => void rename()}
              onDelete={() => void confirmAndDelete()}
              disabled={isDeleting}
              inListRow
              triggerTrackingId="projects.sidebar.project_menu"
            />
          }
        />
        <CollapsibleContent>
          <ProjectSessionList
            projectId={project.id}
            onlySessionIds={onlySessionIds}
            runStates={runStates}
          />
        </CollapsibleContent>
      </Collapsible>
      <ConfirmationDialog {...confirmation} />
    </li>
  );
}
