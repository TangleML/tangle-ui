import { Link as RouterLink } from "@tanstack/react-router";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import { APP_ROUTES } from "@/routes/appRoutes";
import { useGitHubTokenStatus } from "@/services/github/useGitHubToken";
import { getErrorMessage } from "@/utils/string";

import { GitHubTokenPanel } from "./GitHubTokenPanel";
import { RepositoryGrantsPanel } from "./RepositoryGrantsPanel";

const NEW_FINE_GRAINED_TOKEN_URL =
  "https://github.com/settings/personal-access-tokens/new";

function TokenSteps() {
  return (
    <ol className="list-decimal space-y-1 pl-5 text-sm">
      <li>
        <Link href={NEW_FINE_GRAINED_TOKEN_URL} external size="sm">
          Create a fine-grained token on GitHub
        </Link>{" "}
        with Contents: read-only access.
      </li>
      <li>
        Save it as a secret in{" "}
        <RouterLink to={APP_ROUTES.SETTINGS_SECRETS} className="underline">
          Settings → Secrets
        </RouterLink>
        .
      </li>
      <li>Add that secret below.</li>
    </ol>
  );
}

function BackendNotConnected() {
  return (
    <BlockStack align="center" className="py-8">
      <Icon name="DatabaseZap" size="lg" className="text-subdued" />
      <Text tone="subdued">Backend not connected</Text>
      <Text size="xs" tone="subdued">
        Connect a backend in Settings to set up a GitHub token.
      </Text>
    </BlockStack>
  );
}

function GitHubTokenSettings() {
  const { data: support, error, isPending, refetch } = useGitHubTokenStatus();

  if (isPending) {
    return (
      <BlockStack align="center" className="py-8">
        <Spinner size={10} />
      </BlockStack>
    );
  }

  if (error) {
    return (
      <BlockStack gap="4">
        <InfoBox title="Couldn't check your GitHub token" variant="error">
          {getErrorMessage(error)}
        </InfoBox>
        <Button
          variant="secondary"
          className="w-fit"
          onClick={() => void refetch()}
        >
          Try again
        </Button>
      </BlockStack>
    );
  }

  if (!support.supported) {
    return (
      <InfoBox
        title="This backend doesn't support GitHub tokens"
        variant="info"
      >
        Public repositories can still be linked.
      </InfoBox>
    );
  }

  return (
    <BlockStack gap="6">
      {support.status.state !== "valid" && <TokenSteps />}
      <GitHubTokenPanel status={support.status} />
      <Separator />
      <RepositoryGrantsPanel />
    </BlockStack>
  );
}

export function GitHubSettings() {
  const { available } = useBackend();

  return (
    <BlockStack gap="4">
      <BlockStack gap="2">
        <Heading level={2}>GitHub</Heading>
        <Paragraph tone="subdued" size="sm">
          Choose the GitHub token agents use to read the repositories you link
          to projects.
        </Paragraph>
      </BlockStack>

      <Separator />

      {available ? <GitHubTokenSettings /> : <BackendNotConnected />}
    </BlockStack>
  );
}
