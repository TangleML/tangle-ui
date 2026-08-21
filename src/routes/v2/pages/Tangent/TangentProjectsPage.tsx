import { TangentProvider } from "@tangent/embed-react";

import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { BlockStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";
import { useTheme } from "@/providers/ThemeProvider";
import { TANGENT_BASE_URL } from "@/utils/constants";

import { ProjectGrid } from "./components/ProjectGrid";
import { ProjectPromptComposer } from "./components/ProjectPromptComposer";
import { useCreateProjectWithSession } from "./hooks/useCreateProjectWithSession";
import { useTangentProjects } from "./hooks/useTangentProjects";

function TangentProjectsContent() {
  const authStorage = useAuthLocalStorage();
  const projects = useTangentProjects();
  const { createWithPrompt, isCreating } = useCreateProjectWithSession();

  const login = authStorage.getJWT()?.login;
  const greeting = login
    ? `What should we build, ${login}?`
    : "What should we build?";

  return (
    <BlockStack gap="8" className="mx-auto w-full max-w-6xl py-6">
      <BlockStack gap="4" align="center">
        <Heading level={1}>{greeting}</Heading>
        <ProjectPromptComposer
          onSubmit={createWithPrompt}
          isSubmitting={isCreating}
        />
      </BlockStack>

      <BlockStack gap="3">
        <Text size="sm" weight="semibold" tone="subdued">
          My projects
        </Text>
        <ProjectGrid projects={projects ?? []} />
      </BlockStack>
    </BlockStack>
  );
}

export function TangentProjectsPage() {
  const { theme } = useTheme();

  return (
    <TangentProvider baseUrl={TANGENT_BASE_URL} colorScheme={theme}>
      <TangentProjectsContent />
    </TangentProvider>
  );
}
