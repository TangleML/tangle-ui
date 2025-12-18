import { BlockStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Heading } from "@/components/ui/typography";
import { convertGithubUrlToDirectoryUrl, isGithubUrl } from "@/utils/URL";

const linkProps = {
  size: "xs",
  variant: "classic",
  external: true,
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

export function GithubDetails({
  url,
  canonicalUrl,
  className,
}: {
  url?: string;
  canonicalUrl?: string;
  className?: string;
}) {
  if (!url && !canonicalUrl) return null;

  return (
    <BlockStack className={className}>
      <Heading level={3}>URL</Heading>
      {url && (
        <>
          <Link href={url} {...linkProps}>
            View raw component.yaml
          </Link>

          <Link
            href={isGithubUrl(url) ? convertGithubUrlToDirectoryUrl(url) : url}
            {...linkProps}
          >
            View directory on GitHub
          </Link>
        </>
      )}
      {canonicalUrl && (
        <>
          <Link href={canonicalUrl} {...linkProps}>
            View canonical URL
          </Link>

          <Link
            href={convertGithubUrlToDirectoryUrl(canonicalUrl)}
            {...linkProps}
          >
            View canonical URL on GitHub
          </Link>
        </>
      )}
    </BlockStack>
  );
}
