import { ProjectAbout } from "@/components/Project/ProjectAbout";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { useProject } from "@/services/projects/useProjects";
import { formatDate, formatRelativeTime } from "@/utils/date";

export function ProjectWindowContent() {
  const store = useTangentProject();
  const { data: project, isPending } = useProject(store.projectId);

  if (isPending) {
    return (
      <InlineStack gap="2" blockAlign="center" className="p-2">
        <Spinner />
        <Text size="xs" tone="subdued">
          Loading…
        </Text>
      </InlineStack>
    );
  }

  if (!project) {
    return (
      <Text size="xs" tone="subdued" className="block p-2">
        This project could not be loaded.
      </Text>
    );
  }

  return (
    <BlockStack gap="4" align="stretch" className="p-2">
      <ProjectAbout project={project} />

      <Separator />

      <BlockStack gap="1" align="stretch">
        <Detail label="Created by" value={project.createdBy ?? "Unknown"} />
        <Detail label="Created" value={formatDate(project.createdAt)} />
        <Detail
          label="Updated"
          value={formatRelativeTime(project.updatedAt) ?? "Unknown"}
        />
      </BlockStack>
    </BlockStack>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <InlineStack
      gap="2"
      align="space-between"
      blockAlign="start"
      wrap="nowrap"
      className="w-full"
    >
      <Text size="xs" tone="subdued">
        {label}
      </Text>
      <Text size="xs" className="min-w-0 truncate text-right">
        {value}
      </Text>
    </InlineStack>
  );
}
