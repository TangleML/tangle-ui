import { ProjectsSection } from "@/components/Home/ProjectsSection/ProjectsSection";
import { PageHeader } from "@/components/shared/PageHeader";
import { BlockStack } from "@/components/ui/layout";

export function DashboardProjectsView() {
  return (
    <BlockStack gap="4">
      <PageHeader
        title="My Projects"
        description="Group the pipelines, agent sessions and documents you are working on."
        icon="FolderKanban"
      />
      <ProjectsSection />
    </BlockStack>
  );
}
