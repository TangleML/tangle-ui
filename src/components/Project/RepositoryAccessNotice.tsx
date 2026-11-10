import { InfoBox } from "@/components/shared/InfoBox";
import { Text } from "@/components/ui/typography";
import type { RepositoryLocation } from "@/services/github/repositoryUrl";

import { GitHubSettingsLink } from "./GitHubSettingsLink";

interface RepositoryAccessNoticeProps {
  repository: RepositoryLocation;
  tokensSupported: boolean;
}

export function RepositoryAccessNotice({
  repository,
  tokensSupported,
}: RepositoryAccessNoticeProps) {
  if (repository.isPrivate) {
    return (
      <InfoBox title="Private repository" variant="warning">
        Anyone who can open this project can read it.
      </InfoBox>
    );
  }

  if (repository.grantId || !tokensSupported) return null;

  return (
    <InfoBox title="No GitHub token" variant="info">
      <Text size="sm">
        Add one in <GitHubSettingsLink />.
      </Text>
    </InfoBox>
  );
}
