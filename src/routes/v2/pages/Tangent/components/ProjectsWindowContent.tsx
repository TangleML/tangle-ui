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
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/routes/appRoutes";
import { newTangentSessionSearch } from "@/routes/tangentSearch";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useOpenTangentProject } from "@/routes/v2/pages/Tangent/hooks/useOpenTangentProject";
import { useAiGate } from "@/routes/v2/shared/components/AiChat/components/useAiGate";
import { useOptionalWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { activeWorkspaces } from "@/services/projects/defaultWorkspace";
import type { ProjectSummary } from "@/services/projects/types";
import { usePinnedProjects } from "@/services/projects/usePinnedProjects";
import { useProject } from "@/services/projects/useProjects";
import { useReachableProjects } from "@/services/projects/useReachableProjects";
import { useWorkspaces } from "@/services/projects/useWorkspaces";
import { tracking } from "@/utils/tracking";
import { getStorage } from "@/utils/typedStorage";

import { SessionsWindowContent } from "./SessionsWindowContent";

const EXPANDED_KEY = "tangent-sidebar-expanded-projects";

const storage = getStorage<
  typeof EXPANDED_KEY,
  { [EXPANDED_KEY]: Record<string, boolean> }
>();

/**
 * Every project someone can get back to, each with its sessions, so moving
 * between projects is one click. "New chat" starts in whichever project was
 * clicked last, which is the one in view until another is touched.
 */
export const ProjectsWindowContent = observer(function ProjectsWindowContent() {
  const store = useTangentProject();
  const openProject = useOpenTangentProject();
  const aiGate = useAiGate("New chat");
  const { projects: reachable } = useReachableProjects();
  const { projects: pinnedProjects } = usePinnedProjects();
  const { data: projectInView } = useProject(store.projectId);
  const { data: workspaces } = useWorkspaces();
  const dismissFlyout = useOptionalWindowContext()?.dismissFlyout;
  const [targetProjectId, setTargetProjectId] = useState(store.projectId);
  const [projectIdInView, setProjectIdInView] = useState(store.projectId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => ({
    ...storage.getItem(EXPANDED_KEY),
    [store.projectId]: true,
  }));

  // This panel outlives a move to another project in place, so the project
  // arrived in becomes the target and is opened, as it is on a fresh mount.
  if (projectIdInView !== store.projectId) {
    setProjectIdInView(store.projectId);
    setTargetProjectId(store.projectId);
    setExpanded((current) => ({ ...current, [store.projectId]: true }));
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
  const pinnedIds = new Set(pinnedProjects.map(({ id }) => id));
  const pinned = projects.filter(({ id }) => pinnedIds.has(id));
  const unpinned = projects.filter(({ id }) => !pinnedIds.has(id));

  function setOpen(projectId: string, open: boolean) {
    setTargetProjectId(projectId);
    const next = { ...expanded, [projectId]: open };
    setExpanded(next);
    storage.setItem(EXPANDED_KEY, next);
  }

  function startChat() {
    dismissFlyout?.();
    if (!target || target.id === store.projectId) {
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
          className="min-w-0 flex-1 justify-start"
          title={
            aiGate.disabled || !target
              ? aiGate.title
              : `New chat in ${target.name}`
          }
          disabled={store.isStartingSession || aiGate.disabled}
          onClick={startChat}
          {...tracking("projects.sidebar.new_chat")}
        >
          <Icon name={store.isStartingSession ? "Loader" : "SquarePen"} />
          New chat
        </Button>
        {workspaces && activeWorkspaces(workspaces).length > 0 && (
          <CreateProjectDialog
            workspaces={workspaces}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                aria-label="New project"
                title="New project"
                className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Icon name="FolderPlus" size="sm" />
              </Button>
            }
          />
        )}
        <Link
          to={APP_ROUTES.PROJECTS}
          aria-label="All projects"
          title="All projects"
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          {...tracking("projects.sidebar.all_projects")}
        >
          <Icon name="LayoutGrid" size="sm" />
        </Link>
      </InlineStack>

      <BlockStack gap="3" align="stretch">
        {pinned.length > 0 && (
          <ProjectSection title="Pinned">
            {pinned.map(renderGroup)}
          </ProjectSection>
        )}
        {unpinned.length > 0 && (
          <ProjectSection title={pinned.length > 0 ? "Projects" : undefined}>
            {unpinned.map(renderGroup)}
          </ProjectSection>
        )}
      </BlockStack>
    </BlockStack>
  );

  function renderGroup(project: ProjectSummary) {
    return (
      <ProjectGroup
        key={project.id}
        project={project}
        open={expanded[project.id] ?? false}
        inView={project.id === store.projectId}
        onOpenChange={(open) => setOpen(project.id, open)}
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

function ProjectGroup({
  project,
  open,
  inView,
  onOpenChange,
}: {
  project: ProjectSummary;
  open: boolean;
  inView: boolean;
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
        <div className="group/project flex items-center rounded-md pe-1 transition-colors hover:bg-foreground/5 motion-reduce:transition-none">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              {...tracking("projects.sidebar.toggle_project")}
            >
              <Icon
                name={open ? "FolderOpen" : "Folder"}
                size="sm"
                className="shrink-0 text-muted-foreground"
              />
              <Text
                size="sm"
                weight="medium"
                className="min-w-0 flex-1 truncate"
              >
                {project.name}
              </Text>
            </button>
          </CollapsibleTrigger>
          <ProjectMenu
            project={project}
            onRename={() => void rename()}
            onDelete={() => void confirmAndDelete()}
            disabled={isDeleting}
            triggerClassName="hidden size-6 shrink-0 text-muted-foreground hover:text-foreground group-focus-within/project:flex group-hover/project:flex data-[state=open]:flex pointer-coarse:flex"
            triggerTrackingId="projects.sidebar.project_menu"
          />
        </div>
        <CollapsibleContent>
          <SessionsWindowContent projectId={project.id} />
        </CollapsibleContent>
      </Collapsible>
      <ConfirmationDialog {...confirmation} />
    </li>
  );
}
