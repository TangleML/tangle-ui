import { CopyText } from "@/components/shared/CopyText/CopyText";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { convertArtifactUriToHTTPUrl } from "@/utils/URL";

interface ArtifactURIProps {
  uri: string;
  isDir: boolean;
}

const ArtifactURI = ({ uri, isDir }: ArtifactURIProps) => {
  return (
    <InlineStack gap="1" wrap="nowrap" blockAlign="center">
      <Link href={convertArtifactUriToHTTPUrl(uri, isDir)} external size="xs">
        Link
      </Link>

      <Icon name="Dot" size="md" className="text-muted-foreground" />

      <CopyText
        size="xs"
        compact
        displayValue="Copy URI"
        className="text-sky-500 hover:text-sky-600"
      >
        {uri}
      </CopyText>
    </InlineStack>
  );
};

export default ArtifactURI;
