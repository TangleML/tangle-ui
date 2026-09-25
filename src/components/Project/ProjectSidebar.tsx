import type { ReactNode } from "react";

import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Heading, Text } from "@/components/ui/typography";
import type { Project } from "@/services/projects/types";
import { formatDate, formatRelativeTime } from "@/utils/date";

import { ColumnHeadingRow } from "./ColumnHeadingRow";
import { ProjectAbout } from "./ProjectAbout";
import { ProjectActions } from "./ProjectActions";

const HEADING_ID = "project-sidebar-heading";

interface ProjectSidebarProps {
  project: Project;
}

export function ProjectSidebar({ project }: ProjectSidebarProps) {
  const tangentEnabled = useFlagValue("tangent-shell");

  return (
    <aside
      aria-labelledby={HEADING_ID}
      className="w-full max-w-md xl:w-80 xl:max-w-none xl:shrink-0"
    >
      <BlockStack gap="4">
        <ColumnHeadingRow>
          <Heading level={2} id={HEADING_ID}>
            Details
          </Heading>
        </ColumnHeadingRow>

        <BlockStack
          gap="4"
          className="rounded-lg border border-border bg-card p-4"
        >
          {/* Instructions are standing context for agents, so they have
              nothing to say until Tangent is on. */}
          <ProjectAbout project={project} showInstructions={tangentEnabled} />

          <Separator />

          <BlockStack gap="2">
            <Text size="sm" weight="medium">
              Details
            </Text>
            <BlockStack gap="1" className="w-full">
              <Detail
                label="Created by"
                value={project.createdBy ?? "Unknown"}
              />
              <Detail label="Created" value={formatDate(project.createdAt)} />
              <Detail
                label="Updated"
                value={formatRelativeTime(project.updatedAt)}
              />
            </BlockStack>
          </BlockStack>

          <Separator />

          <ProjectActions project={project} />
        </BlockStack>
      </BlockStack>
    </aside>
  );
}

interface DetailProps {
  label: string;
  value: ReactNode;
}

function Detail({ label, value }: DetailProps) {
  return (
    <InlineStack
      gap="2"
      align="space-between"
      blockAlign="start"
      wrap="nowrap"
      className="w-full"
    >
      <Text size="sm" tone="subdued">
        {label}
      </Text>
      <Text size="sm" className="truncate text-right">
        {value}
      </Text>
    </InlineStack>
  );
}
