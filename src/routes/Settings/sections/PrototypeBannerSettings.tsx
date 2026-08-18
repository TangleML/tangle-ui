import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { SYSTEM_UI_USER_ID } from "@/utils/constants";

import {
  bannerText,
  bannerTimestamp,
  latestBanner,
  type PrototypeBanner,
  usePrototypeBanners,
  useSavePrototypeBanner,
} from "./prototypeBanners";

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

function BannerRow({ banner }: { banner: PrototypeBanner }) {
  return (
    <BlockStack gap="1">
      <Text size="xs" tone="subdued">
        {formatTimestamp(bannerTimestamp(banner))}
      </Text>
      <Text size="sm">{bannerText(banner)}</Text>
    </BlockStack>
  );
}

/**
 * Prototype panel for banner content served from the backend instead of a
 * frontend deploy. Banners are stored as one JSON list in user settings under
 * the `system:web_ui` namespace.
 */
export function PrototypeBannerSettings() {
  const notify = useToastNotification();
  const { available } = useBackend();
  const [draft, setDraft] = useState("");

  const {
    data: banners = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = usePrototypeBanners();
  const { mutate: saveBanner, isPending } = useSavePrototypeBanner();

  const latest = latestBanner(banners);
  const trimmedDraft = draft.trim();

  const handleSave = () => {
    if (!trimmedDraft) return;

    saveBanner(trimmedDraft, {
      onSuccess: () => {
        setDraft("");
        notify("Banner saved", "success");
      },
      onError: (saveError) => {
        notify(`Failed to save banner: ${saveError.message}`, "error");
      },
    });
  };

  return (
    <BlockStack gap="4">
      <BlockStack gap="2">
        <Heading level={2}>Prototype Banner</Heading>
        <Paragraph tone="subdued" size="sm">
          Store banner text in the backend so it can change without a frontend
          deploy. Banners are kept as a history list under the{" "}
          <code>{SYSTEM_UI_USER_ID}</code> settings namespace.
        </Paragraph>
      </BlockStack>

      <Separator />

      {!available ? (
        <Paragraph tone="subdued" size="sm">
          Connect a backend to read and write banners.
        </Paragraph>
      ) : (
        <BlockStack gap="4">
          <BlockStack gap="2">
            <InlineStack gap="2" blockAlign="center">
              <Text weight="semibold">Latest banner</Text>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="prototype-banner-refresh"
              >
                <Icon name="RefreshCw" size="sm" />
              </Button>
            </InlineStack>
            <div data-testid="prototype-banner-latest">
              {isLoading ? (
                <Text size="sm" tone="subdued">
                  Loading…
                </Text>
              ) : error ? (
                <Text size="sm" tone="critical">
                  {error.message}
                </Text>
              ) : latest ? (
                <BannerRow banner={latest} />
              ) : (
                <Text size="sm" tone="subdued">
                  No banners yet.
                </Text>
              )}
            </div>
          </BlockStack>

          <Separator />

          <BlockStack gap="2">
            <Text weight="semibold">New banner</Text>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Runs are delayed while we recover a cluster."
              rows={3}
              data-testid="prototype-banner-input"
            />
            <InlineStack>
              <Button
                onClick={handleSave}
                disabled={!trimmedDraft || isPending}
                data-testid="prototype-banner-save"
              >
                Save banner
              </Button>
            </InlineStack>
          </BlockStack>

          <Separator />

          <BlockStack gap="2">
            <Text weight="semibold">History ({banners.length})</Text>
            <div className="w-full" data-testid="prototype-banner-history">
              {banners.length === 0 ? (
                <Text size="sm" tone="subdued">
                  Saved banners appear here, newest first.
                </Text>
              ) : (
                <BlockStack gap="3">
                  {banners.map((banner, index) => (
                    // Two banners can share a timestamp, so the index keeps
                    // the key unique.
                    <BannerRow
                      key={`${bannerTimestamp(banner)}-${index}`}
                      banner={banner}
                    />
                  ))}
                </BlockStack>
              )}
            </div>
          </BlockStack>
        </BlockStack>
      )}
    </BlockStack>
  );
}
