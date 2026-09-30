import { Link } from "@tanstack/react-router";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";
import { APP_ROUTES } from "@/routes/appRoutes";
import type { Project } from "@/services/projects/types";
import { tracking } from "@/utils/tracking";

interface ProjectHeaderProps {
  project: Project;
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  return (
    <BlockStack gap="2">
      <Link
        to={APP_ROUTES.PROJECTS}
        className="w-fit text-muted-foreground hover:text-foreground"
        {...tracking("projects.project_page.back")}
      >
        <InlineStack gap="1" blockAlign="center">
          <Icon name="ArrowLeft" size="sm" aria-hidden="true" />
          <Text size="sm">Back to projects</Text>
        </InlineStack>
      </Link>

      <InlineStack gap="3" blockAlign="center" wrap="nowrap" className="w-full">
        <Icon
          name="Folder"
          size="xl"
          className="shrink-0 text-primary"
          aria-hidden="true"
        />
        <Heading level={1} className="truncate">
          {project.name}
        </Heading>
      </InlineStack>
    </BlockStack>
  );
}
