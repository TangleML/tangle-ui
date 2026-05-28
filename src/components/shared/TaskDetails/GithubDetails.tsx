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

function getGithubDirectoryUrl(url: string): string | null {
  if (!isGithubUrl(url)) return null;

  try {
    return convertGithubUrlToDirectoryUrl(url);
  } catch {
    return null;
  }
}

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
  const directoryUrl = url ? getGithubDirectoryUrl(url) : null;
  const canonicalDirectoryUrl = canonicalUrl
    ? getGithubDirectoryUrl(canonicalUrl)
    : null;
  const documentationDirectoryUrl = documentationUrl
    ? getGithubDirectoryUrl(documentationUrl)
    : null;

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

              {directoryUrl && (
                <Link href={directoryUrl} {...linkProps}>
                  View directory on GitHub
                </Link>
              )}
            </>
          )}
          {!!canonicalUrl && (
            <>
              <Link href={canonicalUrl} {...linkProps}>
                View canonical URL
              </Link>

              {canonicalDirectoryUrl && (
                <Link href={canonicalDirectoryUrl} {...linkProps}>
                  View canonical URL on GitHub
                </Link>
              )}
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

          {documentationDirectoryUrl && (
            <Link href={documentationDirectoryUrl} {...linkProps}>
              View directory on GitHub
            </Link>
          )}
        </BlockStack>
      )}
    </BlockStack>
  );
}
