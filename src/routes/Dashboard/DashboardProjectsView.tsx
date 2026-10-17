import { ProjectsSection } from "@/components/Home/ProjectsSection/ProjectsSection";
import { StartSessionPrompt } from "@/components/Home/ProjectsSection/StartSessionPrompt";
import { PageHeader } from "@/components/shared/PageHeader";
import { useTangentEnabled } from "@/components/shared/Settings/useFlags";
import { BlockStack } from "@/components/ui/layout";
import { Heading } from "@/components/ui/typography";

const PROJECTS_HEADER = {
  title: "Projects",
  description:
    "Group the pipelines, documents and runs that belong to a piece of work.",
  icon: "Folder",
} as const;

const TANGENT_HEADER = {
  title: "Tangent",
  description:
    "Ask an agent to build, run and debug your pipelines. Every session keeps its work in a project.",
  icon: "Bot",
} as const;

export function DashboardProjectsView() {
  const tangentEnabled = useTangentEnabled();

  return (
    <BlockStack gap="6">
      <PageHeader {...(tangentEnabled ? TANGENT_HEADER : PROJECTS_HEADER)} />

      {tangentEnabled && (
        <BlockStack gap="4" fill className="py-12">
          <Heading
            level={1}
            className="text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            What should we build?
          </Heading>
          <StartSessionPrompt />
        </BlockStack>
      )}

      <BlockStack gap="4">
        {tangentEnabled && <Heading level={2}>Projects</Heading>}
        <ProjectsSection />
      </BlockStack>
    </BlockStack>
  );
}
