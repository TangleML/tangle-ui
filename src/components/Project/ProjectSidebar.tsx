import type { ReactNode } from "react";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import type { Project } from "@/services/projects/types";
import { formatDate, formatRelativeTime } from "@/utils/date";

import { ProjectAbout } from "./ProjectAbout";
import { ProjectActions } from "./ProjectActions";

interface ProjectSidebarProps {
  project: Project;
}

export function ProjectSidebar({ project }: ProjectSidebarProps) {
  return (
    <aside
      aria-label="Project details"
      className="w-full max-w-md lg:max-w-none"
    >
      <BlockStack
        gap="4"
        className="rounded-lg border border-border bg-card p-4"
      >
        <ProjectAbout project={project} />

        <Separator />

        <BlockStack gap="2">
          <Text size="sm" weight="medium">
            Details
          </Text>
          <BlockStack gap="1" className="w-full">
            <Detail label="Created by" value={project.createdBy ?? "Unknown"} />
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
