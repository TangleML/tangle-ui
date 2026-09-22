import { ProjectsSection } from "@/components/Home/ProjectsSection/ProjectsSection";
import { SharedProjectsSection } from "@/components/Home/ProjectsSection/SharedProjectsSection";
import { StartSessionPrompt } from "@/components/Home/ProjectsSection/StartSessionPrompt";
import { PageHeader } from "@/components/shared/PageHeader";
import { BlockStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

export function DashboardProjectsView() {
  return (
    <BlockStack gap="6">
      <PageHeader
        title="Tangent"
        description="Ask an agent to build, run and debug your pipelines. Every session keeps its work in a project."
        icon="Bot"
      />

      <BlockStack gap="4" fill className="py-12">
        <Heading
          level={1}
          className="text-3xl font-semibold tracking-tight sm:text-4xl"
        >
          What should we build?
        </Heading>
        <StartSessionPrompt />
      </BlockStack>

      <BlockStack gap="4">
        <Heading level={2}>My Projects</Heading>
        <ProjectsSection />
      </BlockStack>

      <SharedProjectsSection />
    </BlockStack>
  );
}
