import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/routes/appRoutes";
import type { TangentProjectSummary } from "@/routes/v2/pages/Tangent/hooks/useTangentProjects";
import {
  deleteProject,
  renameProject,
} from "@/services/tangentStorage/projects";
import { formatRelativeTime } from "@/utils/date";

import { RenameProjectDialog } from "./RenameProjectDialog";

interface ProjectCardProps {
  project: TangentProjectSummary;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();
  const [renameOpen, setRenameOpen] = useState(false);

  const isActive = project.status === "active";
  const relativeActivity = formatRelativeTime(new Date(project.lastActivityAt));

  function open() {
    void navigate({
      to: APP_ROUTES.TANGENT_PROJECT,
      params: { projectId: project.id },
    });
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
          }
        }}
        className="group cursor-pointer rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BlockStack gap="3">
          <div className="flex h-24 w-full items-center justify-center rounded-lg border border-border bg-muted/40 bg-[radial-gradient(circle,theme(colors.border)_1px,transparent_1px)] [background-size:12px_12px]">
            <Icon
              name="Workflow"
              size="xl"
              className="text-muted-foreground/40"
            />
          </div>

          <InlineStack
            align="space-between"
            blockAlign="start"
            gap="2"
            wrap="nowrap"
            className="w-full"
          >
            <Text size="sm" weight="semibold" className="min-w-0 truncate">
              {project.name}
            </Text>
            <div
              className="shrink-0"
              onClick={(event) => event.stopPropagation()}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="min"
                    aria-label="Project actions"
                    className="opacity-0 group-hover:opacity-100"
                  >
                    <Icon name="EllipsisVertical" size="xs" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                    <Icon name="Pencil" size="xs" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => void deleteProject(project.id)}
                  >
                    <Icon name="Trash2" size="xs" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </InlineStack>

          <InlineStack gap="2" blockAlign="center">
            <Badge
              variant="dot"
              className={cn(
                isActive ? "text-green-500" : "text-muted-foreground",
              )}
            />
            <Text size="xs" tone="subdued">
              {isActive ? "Active" : "Idle"}
              {relativeActivity ? ` · ${relativeActivity}` : ""}
            </Text>
          </InlineStack>

          <Text size="xs" tone="subdued">
            {project.sessionCount === 1
              ? "1 session"
              : `${project.sessionCount} sessions`}
          </Text>
        </BlockStack>
      </div>

      <RenameProjectDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentName={project.name}
        onRename={(name) => {
          void renameProject(project.id, name);
          setRenameOpen(false);
        }}
      />
    </>
  );
}
