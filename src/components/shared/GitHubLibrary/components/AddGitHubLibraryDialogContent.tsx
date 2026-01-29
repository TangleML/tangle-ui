import { useMutation } from "@tanstack/react-query";
import { useReducer, useState } from "react";

import { ensureGithubLibrary } from "@/components/shared/GitHubLibrary/utils/ensureGithubLibrary";
import { fetchGitHubFiles } from "@/components/shared/GitHubLibrary/utils/fetchGitHubFiles";
import { trimDigest } from "@/components/shared/ManageComponent/utils/digest";
import { hydrateAllComponents } from "@/components/shared/ManageComponent/utils/hydrateAllComponents";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import type { HydratedComponentReference } from "@/utils/componentSpec";
import { pluralize } from "@/utils/string";

import { validatePAT } from "../utils/validatePAT";
import { InputField } from "./InputField";

const ComponentList = ({
  components,
}: {
  components: HydratedComponentReference[];
}) => {
  return (
    <ScrollArea type="always" className="max-h-100 w-full">
      <BlockStack gap="2">
        {components.map((component) => (
          <InlineStack
            align="start"
            gap="1"
            className="w-full"
            key={component.digest}
            wrap="nowrap"
          >
            <Icon name="File" className="text-gray-400" size="lg" />

            <BlockStack align="start" gap="0">
              <Text className="truncate max-w-106.25">{component.name}</Text>
              <Text size="xs" tone="subdued" className="font-mono">
                Ver: {trimDigest(component.digest)}
              </Text>
            </BlockStack>
          </InlineStack>
        ))}
      </BlockStack>
    </ScrollArea>
  );
};

export const AddGitHubLibraryDialogContent = ({
  onOkClick,
}: {
  onOkClick: () => void;
}) => {
  const [components, setComponents] = useState<HydratedComponentReference[]>(
    [],
  );

  return (
    <BlockStack gap="2">
      {components.length > 0 ? (
        <ImportResults components={components} onOkClick={onOkClick} />
      ) : (
        <ConfigureImport onSuccess={setComponents} />
      )}
    </BlockStack>
  );
};

function ImportResults({
  components,
  onOkClick,
}: {
  components: HydratedComponentReference[];
  onOkClick: () => void;
}) {
  return (
    <BlockStack gap="2">
      <Heading level={2}>
        Imported {components.length} {pluralize(components.length, "component")}
        :
      </Heading>
      <ComponentList components={components} />
      <BlockStack gap="1" align="end">
        <Button type="button" variant="secondary" onClick={onOkClick}>
          Continue
        </Button>
      </BlockStack>
    </BlockStack>
  );
}

interface GitHubLibraryProcessState {
  repoName: string;
  accessToken: string;
  hasErrors: boolean;
}

type GitHubLibraryFormAction = {
  type: "UPDATE";
  payload: Partial<Omit<GitHubLibraryProcessState, "hasErrors">>;
};

function addGithubLibraryReducer(
  state: GitHubLibraryProcessState,
  action: GitHubLibraryFormAction,
): GitHubLibraryProcessState {
  switch (action.type) {
    case "UPDATE": {
      const newState = { ...state, ...action.payload };
      return {
        ...newState,
        hasErrors: !isStateValid(newState),
      };
    }
    default:
      return state;
  }
}

function ConfigureImport({
  onSuccess,
}: {
  onSuccess: (components: HydratedComponentReference[]) => void;
}) {
  const notify = useToastNotification();

  const initialState: GitHubLibraryProcessState = {
    repoName: "",
    accessToken: "",
    hasErrors: true,
  };

  const [state, dispatch] = useReducer(addGithubLibraryReducer, initialState);
  const [processError, setProcessError] = useState<string | null>(null);

  const { mutate: importComponentsFromGitHubLibrary, isPending } = useMutation({
    mutationFn: async (state: GitHubLibraryProcessState) => {
      const files = await fetchGitHubFiles(
        state.accessToken,
        state.repoName,
        // todo: in future add support for other patterns
        (name) => name.endsWith(".component.yaml"),
      );

      const hydratedComponents = await hydrateAllComponents(
        files.map((file) => ({
          url: file.url,
          text: file.content,
        })),
      );

      // create a library with the hydrated components
      await ensureGithubLibrary({
        repoName: state.repoName,
        accessToken: state.accessToken,
        components: hydratedComponents,
      });

      return hydratedComponents;
    },
    onSuccess: (components) => {
      notify(`Successfully fetched ${components.length} components`, "success");
      onSuccess(components);
    },
    onError: (error) => {
      notify(
        `Error importing components from GitHub library: ${error.message}`,
        "error",
      );
      setProcessError(error.message);
    },
  });

  const handleSubmit = async () => {
    if (state.hasErrors) {
      notify("Please fill in all fields", "error");
      return;
    }

    setProcessError(null);

    await importComponentsFromGitHubLibrary(state);
  };

  return (
    <BlockStack
      gap="4"
      className={cn(isPending && "pointer-events-none opacity-50")}
    >
      <Paragraph tone="subdued" size="xs">
        Connect a GitHub repository to import components from your library. You
        can use a Personal Access Token to access repositories (ensure it has
        the `repo` view-only scope).
      </Paragraph>
      <Paragraph tone="subdued" size="xs">
        By default system will scan for files with the `.component.yaml`
        extension.
      </Paragraph>
      {processError && (
        <Text size="xs" tone="critical">
          {processError}
        </Text>
      )}
      <InputField
        id="repo-name"
        label="Repository Name"
        placeholder="owner/repository"
        value={state.repoName}
        validate={validateRepoName}
        onChange={(value) => {
          dispatch({ type: "UPDATE", payload: { repoName: value ?? "" } });
        }}
      />
      <InputField
        id="pat"
        label="Personal Access Token"
        placeholder="ghp_..."
        value={state.accessToken}
        validate={validatePAT}
        onChange={(value) => {
          dispatch({ type: "UPDATE", payload: { accessToken: value ?? "" } });
        }}
      />

      <InlineStack gap="2" className="w-full" align="end">
        <Button
          type="button"
          disabled={state.hasErrors || isPending}
          onClick={handleSubmit}
        >
          Add Library {isPending && <Spinner />}
        </Button>
      </InlineStack>
    </BlockStack>
  );
}

function isStateValid(state: GitHubLibraryProcessState): boolean {
  return (
    !validateRepoName(state.repoName)?.length &&
    !validatePAT(state.accessToken)?.length
  );
}

function validateRepoName(name: string): string[] | null {
  // GitHub repo name format: owner/repository
  const repoRegex = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/;
  return repoRegex.test(name)
    ? null
    : ["Invalid repository name. Must be in the format of owner/repository"];
}
