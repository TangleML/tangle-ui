import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
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
  const { owner, repo, ref, path, isPrivate } = repository;

  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-left">
      <Text as="dt" size="sm" tone="subdued">
        Repository
      </Text>
      <Text as="dd" size="sm" className="break-all">
        <span>{`${owner}/${repo}`}</span>
        {isPrivate && (
          <Badge size="sm" variant="secondary" className="ml-2 align-middle">
            <Icon name="Lock" size="xs" />
            Private
          </Badge>
        )}
      </Text>

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
