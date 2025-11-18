import { useMutation } from "@tanstack/react-query";
import { type ChangeEvent, type ReactNode, useCallback, useState } from "react";

import { createGithubLibrary } from "@/components/shared/GitHubLibrary/ensureGithubLibrary";
import { fetchGitHubFiles } from "@/components/shared/GitHubLibrary/utils/fetchGitHubFiles";
import { trimDigest } from "@/components/shared/ManageComponent/utils/digest";
import { hydrateAllComponents } from "@/components/shared/ManageComponent/utils/hydrateAllComponents";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import type { HydratedComponentReference } from "@/utils/componentSpec";

interface AddGitHubLibraryDialogProps {
  trigger?: ReactNode;
  onOpenChange?: (open: boolean) => void;
}

interface InputFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  hint?: ReactNode | string;
  validate: (value: string) => string[] | null;
  onChange: (value: string | null, error: string[] | null) => void;
}

const InputField = ({
  id,
  label,
  placeholder,
  value,
  hint,
  validate,
  onChange,
}: InputFieldProps) => {
  const [inputValue, setInputValue] = useState(value);
  const [error, setError] = useState<string[] | null>(null);
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      setInputValue(value);

      const validationErrors = validate(value);
      setError(validationErrors);

      if (validationErrors && validationErrors.length > 0) {
        onChange(null, validationErrors);
      } else {
        onChange(value, null);
      }
    },
    [validate, onChange],
  );

  return (
    <BlockStack gap="2">
      <Label htmlFor={id}>{label}</Label>
      <BlockStack gap="0">
        <Input
          id={id}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleChange}
          aria-invalid={!!error}
          aria-describedby={`${id}-hint`}
          className={cn(error && "aria-invalid:border-destructive")}
        />
        {error && error.length > 0 ? (
          <Text size="xs" tone="critical">
            {error.join("\n")}
          </Text>
        ) : null}
      </BlockStack>
      <div id={`${id}-hint`}>{hint}</div>
    </BlockStack>
  );
};

function validateRepoName(name: string): string[] | null {
  // GitHub repo name format: owner/repository
  const repoRegex = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/;
  return repoRegex.test(name)
    ? null
    : ["Invalid repository name. Must be in the format of owner/repository"];
}

function validatePAT(token: string): string[] | null {
  if (!token) return ["Personal Access Token is required"];
  // Basic PAT validation - GitHub PATs start with ghp_ or github_pat_
  return token.startsWith("ghp_") || token.startsWith("github_pat_")
    ? null
    : ["Invalid Personal Access Token. Must start with ghp_ or github_pat_"];
}

interface GitHubLibraryProcessState {
  repoName: string;
  accessToken: string;
  hasErrors: boolean;
}

const ComponentList = ({
  components,
}: {
  components: HydratedComponentReference[];
}) => {
  return (
    <ScrollArea type="always" className="max-h-[400px]">
      <BlockStack gap="2">
        {components.map((component) => (
          <BlockStack gap="0" key={component.digest}>
            <InlineStack align="center" blockAlign="center" gap="1">
              <Icon name="File" />
              <Text className="truncate">{component.name}</Text>
            </InlineStack>
            <Text size="xs" tone="subdued" className="font-mono">
              Ver: {trimDigest(component.digest)}
            </Text>
          </BlockStack>
        ))}
      </BlockStack>
    </ScrollArea>
  );
};

const AddGitHubLibraryDialog = ({
  trigger,
  onOpenChange,
}: AddGitHubLibraryDialogProps) => {
  const notify = useToastNotification();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<GitHubLibraryProcessState>({
    repoName: "",
    accessToken: "",
    hasErrors: true,
  });
  const [components, setComponents] = useState<HydratedComponentReference[]>(
    [],
  );

  const { mutate: importComponentsFromGitHubLibrary, isPending } = useMutation({
    mutationFn: async (state: GitHubLibraryProcessState) => {
      const files = await fetchGitHubFiles(
        state.accessToken,
        state.repoName,
        (name) => name.endsWith(".component.yaml"),
      );

      const hydratedComponents = await hydrateAllComponents(
        files.map((file) => ({
          url: file.url,
          text: file.content,
        })),
      );

      // create a library with the hydrated components
      await createGithubLibrary({
        repoName: state.repoName,
        accessToken: state.accessToken,
        components: hydratedComponents,
      });

      return hydratedComponents;
    },
    onSuccess: (components) => {
      notify(`Successfully fetched ${components.length} components`, "success");
      setComponents(components);
    },
    onError: (error) => {
      console.error("Error importing components from GitHub library", error);
      notify("Error importing components from GitHub library", "error");
    },
  });

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      setOpen(open);
      onOpenChange?.(open);
    },
    [onOpenChange],
  );

  const handleSubmit = useCallback(async () => {
    if (state.hasErrors) {
      notify("Please fill in all fields", "error");
      return;
    }

    await importComponentsFromGitHubLibrary(state);
  }, [importComponentsFromGitHubLibrary, state]);

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="w-full">
      <Icon name="Github" />
      Connect GitHub Library
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect GitHub Library</DialogTitle>
          <DialogDescription>
            Connect a GitHub repository to import components from your library.
            You can use a personal access token to access private repositories.
          </DialogDescription>
        </DialogHeader>

        {components.length > 0 ? (
          <BlockStack gap="1">
            <Heading level={2}>Imported components</Heading>
            <ComponentList components={components} />
          </BlockStack>
        ) : (
          <BlockStack
            gap="4"
            className={cn(isPending && "pointer-events-none opacity-50")}
          >
            <InputField
              id="repo-name"
              label="Repository Name"
              placeholder="owner/repository"
              value=""
              validate={validateRepoName}
              onChange={(value, error) => {
                setState((prev) => ({
                  ...prev,
                  repoName: value ?? "",
                  hasErrors: !!error && error.length > 0,
                }));
              }}
            />
            <InputField
              id="pat"
              label="Personal Access Token"
              placeholder="ghp_..."
              value=""
              validate={validatePAT}
              onChange={(value, error) => {
                setState((prev) => ({
                  ...prev,
                  accessToken: value ?? "",
                  hasErrors: !!error && error.length > 0,
                }));
              }}
            />
          </BlockStack>
        )}

        <DialogFooter className="sm:justify-end">
          {components.length === 0 ? (
            <InlineStack gap="2">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                disabled={state.hasErrors || isPending}
                onClick={handleSubmit}
              >
                Add Library {isPending ? <Spinner /> : null}
              </Button>
            </InlineStack>
          ) : (
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Ok
              </Button>
            </DialogClose>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddGitHubLibraryDialog;
