import { Link, useNavigate } from "@tanstack/react-router";

import { ProjectMenu } from "@/components/Project/ProjectMenu";
import { useDeleteProjectAction } from "@/components/Project/useDeleteProjectAction";
import { useProjectPin } from "@/components/Project/useProjectPin";
import { ConfirmationDialog } from "@/components/shared/Dialogs";
import { useTangentEnabled } from "@/components/shared/Settings/useFlags";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { TableCell, TableRow } from "@/components/ui/table";
import { Paragraph, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { projectHomeRoute } from "@/routes/projectRoutes";
import type { ProjectSummary } from "@/services/projects/types";
import { useWorkspaces } from "@/services/projects/useWorkspaces";
import { formatDate, formatRelativeTime } from "@/utils/date";
import { hasNewTabModifier } from "@/utils/dom";
import { tracking } from "@/utils/tracking";
import { getProjectUrl } from "@/utils/URL";

import {
  formatResourceCounts,
  visibleResourceCounts,
} from "./formatResourceCounts";

interface ProjectCardProps {
  project: ProjectSummary;
  layout?: "card" | "table";
}

export function ProjectCard({ project, layout = "card" }: ProjectCardProps) {
  const navigate = useNavigate();
  const inTable = layout === "table";
  const { confirmAndDelete, isDeleting, confirmation } = useDeleteProjectAction(
    project,
    { navigateAfterDelete: false },
  );
  const { data: workspaces } = useWorkspaces();
  const workspace = workspaces?.find(({ id }) => id === project.workspaceId);
  const tangentEnabled = useTangentEnabled();
  const resources = formatResourceCounts(
    visibleResourceCounts(project.resourceCounts, tangentEnabled),
  );
  const destination = {
    to: projectHomeRoute(tangentEnabled),
    params: { projectId: project.id },
  };
  const createdAt = formatDate(project.createdAt);
  const updatedAt = formatRelativeTime(project.updatedAt);
  const actions = (
    <>
      <ProjectMenu
        project={project}
        onDelete={() => void confirmAndDelete()}
        disabled={isDeleting}
        inListRow={inTable}
        triggerClassName={inTable ? undefined : "absolute right-2 top-2"}
        triggerTrackingId={
          inTable ? "projects.project_row_menu" : "projects.project_card_menu"
        }
      />
      <ConfirmationDialog {...confirmation} />
    </>
  );

  if (inTable) {
    return (
      <TableRow
        className={cn(
          "cursor-pointer text-xs",
          isDeleting && "pointer-events-none opacity-50",
        )}
        onClick={(event) => {
          if (isDeleting) return;
          if (hasNewTabModifier(event)) {
            window.open(
              getProjectUrl(project.id),
              "_blank",
              "noopener,noreferrer",
            );
          } else {
            void navigate(destination);
          }
        }}
      >
        <TableCell className="text-sm">
          <InlineStack blockAlign="center" wrap="nowrap" className="min-h-9">
            <Link
              {...destination}
              disabled={isDeleting}
              onClick={(event) => event.stopPropagation()}
              className="block truncate hover:underline"
              title={project.name}
              {...tracking("projects.project_row")}
            >
              {project.name}
            </Link>
          </InlineStack>
        </TableCell>
        <TableCell className="truncate" title={workspace?.name}>
          {workspace?.name ?? "—"}
        </TableCell>
        <TableCell className="whitespace-normal wrap-anywhere">
          {resources}
        </TableCell>
        <TableCell className="truncate" title={createdAt}>
          {createdAt}
        </TableCell>
        <TableCell className="truncate" title={formatDate(project.updatedAt)}>
          {updatedAt}
        </TableCell>
        <TableCell
          className="text-right"
          onClick={(event) => event.stopPropagation()}
        >
          {actions}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div
      className={cn(
        "relative min-h-56 rounded-lg border border-border bg-card transition-colors hover:bg-muted/50",
        isDeleting && "pointer-events-none opacity-50",
      )}
    >
      <Link
        {...destination}
        className="flex h-full flex-col justify-between gap-2 p-4"
        {...tracking("projects.project_card")}
      >
        <BlockStack gap="2" align="stretch">
          <InlineStack
            gap="2"
            blockAlign="center"
            wrap="nowrap"
            className="pr-8"
          >
            <ProjectCardIcon project={project} />
            <Text weight="semibold" className="min-w-0 truncate">
              {project.name}
            </Text>
          </InlineStack>

          {project.description && (
            <Paragraph
              size="sm"
              tone="subdued"
              className="line-clamp-3 wrap-break-word"
            >
              {project.description}
            </Paragraph>
          )}
        </BlockStack>

        <BlockStack gap="2" align="stretch">
          <Text size="xs" weight="medium" className="truncate">
            {resources}
          </Text>
          <Separator />
          <BlockStack gap="1" align="stretch">
            {workspace && (
              <InlineStack gap="1" blockAlign="center" wrap="nowrap">
                <Icon
                  name="Shapes"
                  size="xs"
                  aria-label="Workspace"
                  className="shrink-0 text-muted-foreground"
                />
                <Text size="xs" tone="subdued" className="min-w-0 truncate">
                  {workspace.name}
                </Text>
              </InlineStack>
            )}
            <Text size="xs" tone="subdued" className="truncate">
              {`Created ${createdAt}`}
            </Text>
            <Text size="xs" tone="subdued" className="truncate">
              {`Updated ${updatedAt}`}
            </Text>
          </BlockStack>
        </BlockStack>
      </Link>

      {actions}
    </div>
  );
}

function ProjectCardIcon({ project }: { project: ProjectSummary }) {
  const { pinned } = useProjectPin(project);
  return (
    <Icon
      name={pinned ? "Pin" : "Folder"}
      size="lg"
      aria-label={pinned ? "Pinned" : undefined}
      className={cn(
        "shrink-0",
        pinned ? "text-brand-accent" : "text-muted-foreground",
      )}
    />
  );
}
