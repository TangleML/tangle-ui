import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import {
  isProblemWithUrl,
  RepositoryLinkError,
  type RepositoryLinkProblem,
  repositoryUrl,
} from "@/services/github/repositoryUrl";
import {
  resolveRepositoryLink,
  type TokenAccess,
} from "@/services/github/resolveRepositoryLink";
import { gitHubTokenStatusQuery } from "@/services/github/useGitHubToken";
import {
  repositoryName,
  repositoryResourceInput,
  repositoryUrlOf,
} from "@/services/projects/resourceDescriptor";
import type {
  CreateResourceInput,
  ProjectResourceSummary,
} from "@/services/projects/types";
import { MINUTES } from "@/utils/constants";
import { getErrorMessage } from "@/utils/string";
import { tracking } from "@/utils/tracking";

import { GitHubSettingsLink } from "./GitHubSettingsLink";
import { RepositoryAccessNotice } from "./RepositoryAccessNotice";
import { RepositoryDetails } from "./RepositoryDetails";

const URL_FIELD_ID = "link-repository-url";
const URL_HINT_ID = "link-repository-url-hint";
const CHECK_ERROR_ID = "link-repository-check-error";

async function checkRepository(url: string, access: TokenAccess | null) {
  const { repository, tokensSupported } = await resolveRepositoryLink(
    url,
    access,
  );
  return {
    repository,
    tokensSupported,
    url: repositoryUrl(repository),
    input: repositoryResourceInput(repository),
  };
}

function useTokenAccess(): TokenAccess | null {
  const { available, backendUrl } = useBackend();
  const queryClient = useQueryClient();
  if (!available) return null;

  return {
    backendUrl,
    readTokenSupport: () =>
      queryClient.fetchQuery({
        ...gitHubTokenStatusQuery(backendUrl),
        staleTime: 0,
      }),
  };
}

function useRepositoryCheck(url: string | null) {
  const access = useTokenAccess();
  return useQuery({
    queryKey: ["github", "repository-link", access?.backendUrl ?? null, url],
    queryFn: url === null ? skipToken : () => checkRepository(url, access),
    retry: false,
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}

const SETTINGS_HINT_LEAD: Partial<Record<RepositoryLinkProblem, string>> = {
  token_unusable: "Check it in ",
  rate_limited: "To look it up with your own GitHub token, choose one in ",
};

function GitHubSettingsHint({ error }: { error: RepositoryLinkError }) {
  return (
    <Text size="sm">
      {SETTINGS_HINT_LEAD[error.problem] ??
        "To link private repositories, choose a GitHub token in "}
      <GitHubSettingsLink />.
    </Text>
  );
}

interface LinkedRepositoryNoticeProps {
  name: string;
  archived: boolean;
  replaceable: boolean;
}

function LinkedRepositoryNotice({
  name,
  archived,
  replaceable,
}: LinkedRepositoryNoticeProps) {
  return (
    <InfoBox title={archived ? "Archived" : "Already linked"} variant="info">
      <BlockStack gap="1">
        <Text size="sm">
          {archived
            ? `${name} is linked to this project, but archived. Restore it to show it again.`
            : `${name} is already linked to this project.`}
        </Text>
        {replaceable && (
          <Text size="sm">
            Replacing removes the current link and links the repository again as
            you, with your GitHub access.
          </Text>
        )}
      </BlockStack>
    </InfoBox>
  );
}

type PrimaryAction = "link" | "restore" | "replace" | "none";

const PRIMARY_LABEL: Record<PrimaryAction, string> = {
  link: "Link",
  restore: "Restore",
  replace: "Replace link",
  none: "Link",
};

const PRIMARY_TRACKING: Record<PrimaryAction, string> = {
  link: "projects.link_repository_submit",
  restore: "projects.link_repository_restore",
  replace: "projects.link_repository_replace",
  none: "projects.link_repository_submit",
};

function primaryActionFor({
  linked,
  restorable,
  replaceable,
}: {
  linked: ProjectResourceSummary | undefined;
  restorable: boolean;
  replaceable: boolean;
}): PrimaryAction {
  if (!linked) return "link";
  if (restorable) return "restore";
  return replaceable ? "replace" : "none";
}

interface RepositoryLinkFormProps {
  resources: ProjectResourceSummary[];
  onSubmit: (input: CreateResourceInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  isArchived?: (resource: ProjectResourceSummary) => boolean;
  onRestore?: (resource: ProjectResourceSummary) => void;
  onReplace?: (
    resource: ProjectResourceSummary,
    input: CreateResourceInput,
  ) => void;
}

export function RepositoryLinkForm({
  resources,
  onSubmit,
  onCancel,
  isSubmitting = false,
  isArchived,
  onRestore,
  onReplace,
}: RepositoryLinkFormProps) {
  const [url, setUrl] = useState("");
  const [checkedUrl, setCheckedUrl] = useState<string | null>(null);
  const {
    data: checked,
    error,
    isFetching,
    refetch,
  } = useRepositoryCheck(checkedUrl);

  const trimmedUrl = url.trim();
  const linked =
    checked === undefined
      ? undefined
      : resources.find((resource) => repositoryUrlOf(resource) === checked.url);
  const restorable =
    linked !== undefined &&
    onRestore !== undefined &&
    isArchived?.(linked) === true;
  const replaceable = linked !== undefined && onReplace !== undefined;
  const busy = checked === undefined || isFetching || isSubmitting;
  const urlRejected = !isFetching && isProblemWithUrl(error);

  const primaryAction = primaryActionFor({ linked, restorable, replaceable });
  const canAct = !busy && primaryAction !== "none";

  const check = () => {
    if (trimmedUrl === "") return;
    if (trimmedUrl === checkedUrl) {
      void refetch();
      return;
    }
    setCheckedUrl(trimmedUrl);
  };

  const replace = () => {
    if (checked === undefined || busy || !linked) return;
    onReplace?.(linked, checked.input);
  };

  const act = () => {
    if (checked === undefined || !canAct) return;
    if (!linked) {
      onSubmit(checked.input);
    } else if (restorable) {
      onRestore?.(linked);
    } else {
      replace();
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    act();
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setCheckedUrl(null);
  };

  return (
    <form onSubmit={handleSubmit} className="min-w-0">
      <BlockStack gap="4">
        <BlockStack gap="2">
          <Label htmlFor={URL_FIELD_ID}>Repository or folder URL</Label>
          <InlineStack gap="2" wrap="nowrap" className="w-full">
            <Input
              id={URL_FIELD_ID}
              value={url}
              onChange={(event) => handleUrlChange(event.target.value)}
              onEnter={checked ? act : check}
              placeholder="https://github.com/owner/repo"
              aria-describedby={
                urlRejected ? `${URL_HINT_ID} ${CHECK_ERROR_ID}` : URL_HINT_ID
              }
              aria-invalid={urlRejected || undefined}
              autoFocus
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={trimmedUrl === "" || isFetching}
              onClick={check}
              {...tracking("projects.link_repository_check")}
            >
              Check
            </Button>
          </InlineStack>
          <Text id={URL_HINT_ID} size="xs" tone="subdued">
            A GitHub repository, or one folder in it.
          </Text>
        </BlockStack>

        <BlockStack gap="3" aria-live="polite">
          {isFetching && (
            <InlineStack gap="2" blockAlign="center">
              <Spinner />
              <Text size="sm">Checking on GitHub...</Text>
            </InlineStack>
          )}

          {!isFetching && error && (
            <InfoBox title="Can't link this repository" variant="error">
              <BlockStack gap="1">
                <Text id={CHECK_ERROR_ID} size="sm">
                  {getErrorMessage(error)}
                </Text>
                {error instanceof RepositoryLinkError && error.needsToken && (
                  <GitHubSettingsHint error={error} />
                )}
              </BlockStack>
            </InfoBox>
          )}

          {!isFetching && checked && (
            <>
              <RepositoryDetails repository={checked.repository} />
              {linked ? (
                <LinkedRepositoryNotice
                  name={repositoryName(checked.repository)}
                  archived={restorable}
                  replaceable={replaceable}
                />
              ) : (
                <RepositoryAccessNotice
                  repository={checked.repository}
                  tokensSupported={checked.tokensSupported}
                />
              )}
            </>
          )}
        </BlockStack>

        <DialogFooter className="w-full">
          <InlineStack gap="2" className="w-full" align="end">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              {...tracking("projects.link_repository_cancel")}
            >
              Cancel
            </Button>
            {restorable && replaceable && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={replace}
                {...tracking("projects.link_repository_replace")}
              >
                Replace link
              </Button>
            )}
            <Button
              type="submit"
              disabled={!canAct}
              {...tracking(PRIMARY_TRACKING[primaryAction])}
            >
              {PRIMARY_LABEL[primaryAction]}
            </Button>
          </InlineStack>
        </DialogFooter>
      </BlockStack>
    </form>
  );
}
