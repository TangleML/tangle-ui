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
  documentationUrl,
  className,
}: {
  url?: string;
  canonicalUrl?: string;
  documentationUrl?: string;
  className?: string;
}) {
  const hasUrl = url || canonicalUrl;

  if (!hasUrl && !documentationUrl) return null;

  return (
    <BlockStack className={className} gap="2">
      {!!hasUrl && (
        <BlockStack>
          <Heading level={3}>URL</Heading>
          {!!url && (
            <>
              <Link href={url} {...linkProps}>
                View raw component.yaml
              </Link>

              <Link
                href={
                  isGithubUrl(url) ? convertGithubUrlToDirectoryUrl(url) : url
                }
                {...linkProps}
              >
                View directory on GitHub
              </Link>
            </>
          )}
          {!!canonicalUrl && (
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
      )}
      {!!documentationUrl && (
        <BlockStack>
          <Heading level={3}>Documentation</Heading>
          <Link href={documentationUrl} {...linkProps}>
            View documentation
          </Link>

          <Link
            href={
              isGithubUrl(documentationUrl)
                ? convertGithubUrlToDirectoryUrl(documentationUrl)
                : documentationUrl
            }
            {...linkProps}
          >
            View directory on GitHub
          </Link>
        </BlockStack>
      )}
    </BlockStack>
  );
}
