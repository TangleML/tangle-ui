import "@/config/announcements";

import { useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { BlockStack } from "@/components/ui/layout";
import { getStorage } from "@/utils/typedStorage";

interface DismissedAnnouncementsStorage {
  "dismissed-announcements": string[];
}

const storage = getStorage<
  keyof DismissedAnnouncementsStorage,
  DismissedAnnouncementsStorage
>();

function getDismissedIds(): string[] {
  return storage.getItem("dismissed-announcements") ?? [];
}

export const AnnouncementBanners = () => {
  const [dismissedIds, setDismissedIds] = useState(getDismissedIds);

  const announcements = window.__TANGLE_ANNOUNCEMENTS__ ?? [];
  const now = new Date();
  const visible = announcements.filter(
    (a) =>
      !dismissedIds.includes(a.id) &&
      (!a.expiresAt || new Date(a.expiresAt) > now),
  );

  if (visible.length === 0) {
    return null;
  }

  const handleDismiss = (id: string) => {
    const updated = [...dismissedIds, id];
    storage.setItem("dismissed-announcements", updated);
    setDismissedIds(updated);
  };

  return (
    <BlockStack gap="2">
      {visible.map((announcement) => {
        const onDismiss = announcement.dismissible
          ? () => handleDismiss(announcement.id)
          : undefined;

        return (
          <InfoBox
            key={announcement.id}
            title={announcement.title}
            variant={announcement.variant ?? "info"}
            width="full"
            onDismiss={onDismiss}
          >
            {announcement.body}
          </InfoBox>
        );
      })}
    </BlockStack>
  );
};
