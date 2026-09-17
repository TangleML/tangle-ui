import { Link } from "@tanstack/react-router";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph, Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/appRoutes";
import type { ProjectSummary } from "@/services/projects/types";
import { formatDate, formatRelativeTime } from "@/utils/date";
import { tracking } from "@/utils/tracking";

import { formatResourceCounts } from "./formatResourceCounts";

interface ProjectCardProps {
  project: ProjectSummary;
  workspaceName: string | undefined;
}

export function ProjectCard({ project, workspaceName }: ProjectCardProps) {
  return (
    <div className="relative rounded-lg border border-border bg-card transition-colors hover:bg-muted/50">
      <Link
        to={APP_ROUTES.PROJECT_DETAIL}
        params={{ projectId: project.id }}
        className="block p-4"
        {...tracking("projects.project_card")}
      >
        <BlockStack gap="2">
          <InlineStack gap="2" blockAlign="center" wrap="nowrap">
            <Icon
              name="Folder"
              size="lg"
              className="text-muted-foreground shrink-0"
            />
            <Text weight="semibold" className="truncate">
              {project.name}
            </Text>
          </InlineStack>

          {project.description && (
            <Paragraph size="sm" tone="subdued" className="line-clamp-2">
              {project.description}
            </Paragraph>
          )}

          <BlockStack gap="1">
            <Text size="xs" tone="subdued">
              {workspaceName ?? "Unknown workspace"}
            </Text>
            <Text size="xs" tone="subdued">
              {formatResourceCounts(project.resourceCounts)}
            </Text>
            <Text size="xs" tone="subdued">
              {`Created ${formatDate(project.createdAt)} · Updated ${formatRelativeTime(project.updatedAt)}`}
            </Text>
          </BlockStack>
        </BlockStack>
      </Link>
    </div>
  );
}
