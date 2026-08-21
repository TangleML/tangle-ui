import { useNavigate } from "@tanstack/react-router";
import { type KeyboardEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { APP_ROUTES } from "@/routes/appRoutes";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { renameProject } from "@/services/tangentStorage/projects";

export function ProjectHeader() {
  const navigate = useNavigate();
  const { project } = useTangentProject();
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState("");

  if (!project) return null;

  const isActive = project.status === "active";

  function beginEdit() {
    setDraftName(project?.name ?? "");
    setIsEditing(true);
  }

  function commit() {
    const trimmed = draftName.trim();
    if (project && trimmed && trimmed !== project.name) {
      void renameProject(project.id, trimmed);
    }
    setIsEditing(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") setIsEditing(false);
  }

  return (
    <InlineStack
      align="space-between"
      blockAlign="center"
      gap="3"
      className="shrink-0 border-b border-border px-4 py-2"
    >
      <InlineStack gap="3" blockAlign="center" className="min-w-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void navigate({ to: APP_ROUTES.TANGENT })}
        >
          <Icon name="ChevronLeft" size="sm" />
          Projects
        </Button>
        {isEditing ? (
          <Input
            value={draftName}
            autoFocus
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className="h-8 w-64"
          />
        ) : (
          <button
            type="button"
            onClick={beginEdit}
            className="min-w-0 rounded-md px-1 hover:bg-accent"
            title="Rename project"
          >
            <Text as="h2" size="sm" weight="semibold" className="truncate">
              {project.name}
            </Text>
          </button>
        )}
      </InlineStack>

      <InlineStack gap="2" blockAlign="center">
        <Badge
          variant="dot"
          className={cn(isActive ? "text-green-500" : "text-muted-foreground")}
        />
        <Badge variant="secondary" size="sm">
          {isActive ? "Active" : "Idle"}
        </Badge>
      </InlineStack>
    </InlineStack>
  );
}
