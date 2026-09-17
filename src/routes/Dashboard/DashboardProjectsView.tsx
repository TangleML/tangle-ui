import { ProjectsSection } from "@/components/Home/ProjectsSection/ProjectsSection";
import { BlockStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

export function DashboardProjectsView() {
  return (
    <BlockStack gap="4">
      <Heading level={2}>Projects</Heading>
      <ProjectsSection />
    </BlockStack>
  );
}
