import { type ReactNode, useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { InfoBox } from "@/components/shared/InfoBox";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { BlockStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Separator } from "@/components/ui/separator";
import { Heading, Paragraph } from "@/components/ui/typography";
import { type TangleBanner, toAbsoluteHttpUrl } from "@/config/banners";
import { useBanners } from "@/hooks/useBanners";
import { CONTENT_OFFSET_VAR, TOP_NAV_HEIGHT } from "@/utils/constants";
import { getStorage } from "@/utils/typedStorage";

interface DismissedBannersStorage {
  "dismissed-banners": string[];
}

const storage = getStorage<
  keyof DismissedBannersStorage,
  DismissedBannersStorage
>();

function getDismissedIds(): string[] {
  return storage.getItem("dismissed-banners") ?? [];
}

const INLINE_CODE_CLASS = "rounded bg-muted px-1 py-0.5 text-xs font-mono";

function bannerUrlTransform(url: string): string {
  return toAbsoluteHttpUrl(url) ?? "";
}

const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <Paragraph size="sm" className="my-1 leading-relaxed">
      {children}
    </Paragraph>
  ),
  /**
   * A plain anchor rather than the Link primitive: Link wraps its children in a
   * flex container, which cannot legally nest inside the phrasing content of a
   * paragraph, heading or list item.
   */
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {children}
    </a>
  ),
  h1: ({ children }: { children?: ReactNode }) => (
    <Heading level={1} size="sm" weight="bold" className="mt-2 mb-1 block">
      {children}
    </Heading>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <Heading level={2} size="sm" weight="bold" className="mt-2 mb-1 block">
      {children}
    </Heading>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <Heading level={3} size="sm" weight="semibold" className="mt-1 block">
      {children}
    </Heading>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="list-disc pl-4 my-1">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="list-decimal pl-4 my-1">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="my-0.5">{children}</li>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-1 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className={INLINE_CODE_CLASS}>{children}</code>
  ),
  pre: ({ children }: { children?: ReactNode }) => <>{children}</>,
  hr: () => <Separator className="my-2" />,
} as const;

const BannerContent = ({ banner }: { banner: TangleBanner }) => {
  const hasBody = banner.body.trim().length > 0;
  const action = banner.action;

  if (!hasBody && !action) return null;

  return (
    <BlockStack gap="1">
      {hasBody && (
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
          urlTransform={bannerUrlTransform}
        >
          {banner.body}
        </Markdown>
      )}
      {action && (
        <Link
          href={action.url}
          size="sm"
          variant="primary"
          external
          aria-label={
            banner.title ? `${action.text}: ${banner.title}` : action.text
          }
        >
          {action.text}
        </Link>
      )}
    </BlockStack>
  );
};

/**
 * Publishes the strip's real height so layouts sizing themselves against the
 * viewport can subtract it. Without this the routes that hardcode a full-height
 * content area overflow by exactly the strip's height, producing a page
 * scrollbar on top of their own inner one.
 */
function useContentOffset(strip: HTMLElement | null) {
  useEffect(() => {
    const root = document.documentElement;

    if (!strip) {
      root.style.removeProperty(CONTENT_OFFSET_VAR);
      return;
    }

    const publishOffset = () => {
      root.style.setProperty(
        CONTENT_OFFSET_VAR,
        `${TOP_NAV_HEIGHT + strip.offsetHeight}px`,
      );
    };

    publishOffset();
    const observer = new ResizeObserver(publishOffset);
    observer.observe(strip);

    return () => {
      observer.disconnect();
      root.style.removeProperty(CONTENT_OFFSET_VAR);
    };
  }, [strip]);
}

export const BannerRegion = () => {
  const banners = useBanners();
  const isFloating = useFlagValue("floating-banners");
  const [dismissedIds, setDismissedIds] = useState(getDismissedIds);
  const [strip, setStrip] = useState<HTMLDivElement | null>(null);

  useContentOffset(isFloating ? null : strip);

  const visible = banners.filter((banner) => !dismissedIds.includes(banner.id));

  if (visible.length === 0) return null;

  const handleDismiss = (id: string) => {
    const updated = [...dismissedIds, id];
    storage.setItem("dismissed-banners", updated);
    setDismissedIds(updated);
  };

  return (
    <div
      ref={setStrip}
      role="status"
      aria-live="polite"
      className={
        isFloating ? "fixed right-4 z-40 w-full max-w-sm" : "px-3 pt-3 md:px-4"
      }
      style={isFloating ? { top: TOP_NAV_HEIGHT + 12 } : undefined}
      data-testid="banner-region"
      data-presentation={isFloating ? "floating" : "inline"}
    >
      <BlockStack gap="2">
        {visible.map((banner) => (
          <InfoBox
            key={banner.id}
            title={banner.title}
            variant={banner.variant}
            width="full"
            onDismiss={
              banner.dismissible ? () => handleDismiss(banner.id) : undefined
            }
          >
            <BannerContent banner={banner} />
          </InfoBox>
        ))}
      </BlockStack>
    </div>
  );
};
