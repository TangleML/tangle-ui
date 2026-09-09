import { NoticeCard } from "@/components/shared/Notices/NoticeCard";
import { InlineStack } from "@/components/ui/layout";
import { useHiddenNotices } from "@/hooks/useHiddenNotices";
import { useNotices } from "@/hooks/useNotices";

const NOTICE_BANNER_LAYOUT_CLASSES =
  "w-full *:min-w-0 *:grow *:basis-full md:*:basis-[calc((100%-1.5rem)/2)] lg:*:basis-[calc((100%-3rem)/3)]";

export const NoticeBanners = () => {
  const { notices } = useNotices();
  const { hiddenIds, hide } = useHiddenNotices();

  const banners = notices.filter((notice) => !hiddenIds.has(notice.id));

  if (banners.length === 0) return null;

  return (
    <InlineStack
      gap="6"
      blockAlign="start"
      wrap="wrap"
      className={NOTICE_BANNER_LAYOUT_CLASSES}
      data-testid="notice-banners"
    >
      {banners.map((notice) => (
        <NoticeCard
          key={notice.id}
          notice={notice}
          clampBody
          onHide={() => hide(notice)}
        />
      ))}
    </InlineStack>
  );
};
