import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

const TONE_BG: Record<string, string> = {
  default: "bg-primary/10 text-primary",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  critical: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const PURPLE_SURFACE_BG = "bg-violet-500/6";
const PURPLE_SURFACE_BG_HOVER = "hover:bg-violet-500/10";
const PURPLE_BORDER = "border-violet-500/25";

export const StatCard = ({
  label,
  value,
  icon,
  tone = "default",
  isLoading,
  onClick,
}: {
  label: string;
  value: string | number;
  icon: Parameters<typeof Icon>[0]["name"];
  tone?: keyof typeof TONE_BG;
  isLoading?: boolean;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={cn(
      "h-full min-h-18 w-full rounded-xl border bg-transparent px-4 py-3 text-left transition-colors",
      PURPLE_BORDER,
      onClick
        ? cn(
            "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            PURPLE_SURFACE_BG_HOVER,
          )
        : "cursor-default",
    )}
  >
    <InlineStack gap="3" blockAlign="center" wrap="nowrap">
      <div className={cn("shrink-0 rounded-lg p-2", TONE_BG[tone])}>
        <Icon name={icon} size="md" />
      </div>
      <BlockStack gap="0">
        {isLoading ? (
          <Skeleton className="h-7 w-8 rounded" />
        ) : (
          <Text as="span" size="xl" weight="bold" className="leading-none">
            {value}
          </Text>
        )}
        <Text as="span" size="xs" tone="subdued" className="leading-none">
          {label}
        </Text>
      </BlockStack>
    </InlineStack>
  </button>
);

export const SectionToggleButton = ({
  label,
  count,
  isActive,
  onToggle,
  showVisibilityIcon = true,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onToggle: () => void;
  showVisibilityIcon?: boolean;
}) => (
  <Button
    variant="outline"
    onClick={onToggle}
    className={cn(
      "h-full min-h-18 w-full rounded-xl px-4 py-3 text-left",
      isActive
        ? cn(PURPLE_BORDER, PURPLE_SURFACE_BG, "text-foreground")
        : cn(PURPLE_BORDER, "bg-transparent text-muted-foreground"),
      "hover:bg-violet-500/10",
    )}
  >
    <InlineStack align="start" blockAlign="center" className="w-full">
      <BlockStack gap="0" align="start">
        <InlineStack gap="1" blockAlign="center">
          <Text as="span" size="xl" weight="bold" className="leading-none">
            {count}
          </Text>
          {showVisibilityIcon && (
            <Icon
              name={isActive ? "Eye" : "EyeOff"}
              size="sm"
              className="text-muted-foreground"
            />
          )}
        </InlineStack>
        <Text as="span" size="xs" tone="subdued" className="leading-none">
          {label}
        </Text>
      </BlockStack>
    </InlineStack>
  </Button>
);
