import { PrivateRepositoryBadge } from "@/components/Project/PrivateRepositoryBadge";
import { WritesAllowedBadge } from "@/components/Project/WritesAllowedBadge";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import {
  isCommitSha,
  type RepositoryLocation,
} from "@/services/github/repositoryUrl";

const refLabel = (ref: string | null) =>
  ref !== null && isCommitSha(ref) ? "Commit" : "Branch";

interface RepositoryDetailsProps {
  repository: RepositoryLocation;
}

export function RepositoryDetails({ repository }: RepositoryDetailsProps) {
  const { owner, repo, ref, path, isPrivate, allowWrites } = repository;

  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-left">
      <Text as="dt" size="sm" tone="subdued">
        Repository
      </Text>
      <InlineStack as="dd" gap="2" blockAlign="center" className="break-all">
        <Text size="sm">{`${owner}/${repo}`}</Text>
        {isPrivate && <PrivateRepositoryBadge />}
        {allowWrites && <WritesAllowedBadge />}
      </InlineStack>

      <Text as="dt" size="sm" tone="subdued">
        {refLabel(ref)}
      </Text>
      <Text
        as="dd"
        size="sm"
        tone={ref === null ? "subdued" : "inherit"}
        className="break-all"
      >
        {ref ?? "Default branch"}
      </Text>

      <Text as="dt" size="sm" tone="subdued">
        Folder
      </Text>
      <Text
        as="dd"
        size="sm"
        tone={path === null ? "subdued" : "inherit"}
        className="break-all"
      >
        {path ?? "Whole repository"}
      </Text>
    </dl>
  );
}
