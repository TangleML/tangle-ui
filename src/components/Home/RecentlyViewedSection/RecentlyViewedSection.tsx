import { useNavigate } from "@tanstack/react-router";
import { Clock, GitBranch, Play } from "lucide-react";

import { InlineStack } from "@/components/ui/layout";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Paragraph, Text } from "@/components/ui/typography";
import {
  type RecentlyViewedItem,
  useRecentlyViewed,
} from "@/hooks/useRecentlyViewed";
import { EDITOR_PATH, RUNS_BASE_PATH } from "@/routes/router";

function getRecentlyViewedUrl(item: RecentlyViewedItem): string {
  if (item.type === "pipeline") return `${EDITOR_PATH}/${item.id}`;
  if (item.type === "run") return `${RUNS_BASE_PATH}/${item.id}`;
  // component support to be added later
  return "/";
}

const RecentlyViewedChip = ({ item }: { item: RecentlyViewedItem }) => {
  const navigate = useNavigate();

  const tooltipContent =
    item.type === "run" ? `${item.name} #${item.id}` : item.name;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          onClick={() => navigate({ to: getRecentlyViewedUrl(item) })}
          className={`flex items-center gap-1.5 pl-2 pr-2 py-1 border rounded-md cursor-pointer w-48 ${
            item.type === "pipeline"
              ? "bg-violet-50/50 hover:bg-violet-50 border-violet-100"
              : "bg-emerald-50/50 hover:bg-emerald-50 border-emerald-100"
          }`}
        >
          {item.type === "pipeline" ? (
            <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Play className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="text-sm truncate">{item.name}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>{tooltipContent}</TooltipContent>
    </Tooltip>
  );
};

export const RecentlyViewedSection = () => {
  const { recentlyViewed } = useRecentlyViewed();

  return (
    <div className="flex flex-col gap-2">
      <InlineStack blockAlign="center" gap="1">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <Text as="h2" size="sm" weight="semibold">
          Recently Viewed
        </Text>
      </InlineStack>

      {recentlyViewed.length === 0 ? (
        <Paragraph tone="subdued" size="sm">
          Nothing viewed yet. Open a pipeline or run to see it here.
        </Paragraph>
      ) : (
        <div className="flex gap-2">
          {recentlyViewed.map((item) => (
            <RecentlyViewedChip key={`${item.type}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};
