import { ProjectsSection } from "@/components/Home/ProjectsSection/ProjectsSection";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { BlockStack } from "@/components/ui/layout";

export function DashboardProjectsView() {
  return (
    <BlockStack gap="4">
      <PageHeader
        title="My Projects"
        description="Organise Pipelines and Runs into shareable containers alongside supporting documents."
        icon="FolderKanban"
        badge={
          <Badge variant="brand" shape="rounded" size="sm">
            Beta
          </Badge>
        }
      />
      <ProjectsSection />
    </BlockStack>
  );
}
