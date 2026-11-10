import { skipToken, useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import {
  isProblemWithUrl,
  repositoryUrl,
  resolveRepositoryUrl,
} from "@/services/github/repositoryUrl";
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

import { RepositoryDetails } from "./RepositoryDetails";

const URL_FIELD_ID = "link-repository-url";
const URL_HINT_ID = "link-repository-url-hint";
const CHECK_ERROR_ID = "link-repository-check-error";

async function checkRepository(url: string) {
  const repository = await resolveRepositoryUrl(url);
  return {
    repository,
    url: repositoryUrl(repository),
    input: repositoryResourceInput(repository),
  };
}

function useRepositoryCheck(url: string | null) {
  return useQuery({
    queryKey: ["github", "repository-link", url],
    queryFn: url === null ? skipToken : () => checkRepository(url),
    retry: false,
    staleTime: 5 * MINUTES,
    refetchOnWindowFocus: false,
  });
}

interface RepositoryLinkFormProps {
  resources: ProjectResourceSummary[];
  onSubmit: (input: CreateResourceInput) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function RepositoryLinkForm({
  resources,
  onSubmit,
  onCancel,
  isSubmitting = false,
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
  const alreadyLinked =
    checked !== undefined &&
    resources.some((resource) => repositoryUrlOf(resource) === checked.url);
  const canLink =
    checked !== undefined && !alreadyLinked && !isFetching && !isSubmitting;
  const urlRejected = !isFetching && isProblemWithUrl(error);

  const check = () => {
    if (trimmedUrl === "") return;
    if (trimmedUrl === checkedUrl) {
      void refetch();
      return;
    }
    setCheckedUrl(trimmedUrl);
  };

  const link = () => {
    if (canLink) {
      onSubmit(checked.input);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    link();
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
              onEnter={checked ? link : check}
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
            A public GitHub repository, or one folder in it.
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
              <Text id={CHECK_ERROR_ID} size="sm">
                {getErrorMessage(error)}
              </Text>
            </InfoBox>
          )}

          {!isFetching && checked && (
            <>
              <RepositoryDetails repository={checked.repository} />
              {alreadyLinked && (
                <InfoBox title="Already linked" variant="info">
                  {`${repositoryName(checked.repository)} is already linked to this project.`}
                </InfoBox>
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
            <Button
              type="submit"
              disabled={!canLink}
              {...tracking("projects.link_repository_submit")}
            >
              Link
            </Button>
          </InlineStack>
        </DialogFooter>
      </BlockStack>
    </form>
  );
}
