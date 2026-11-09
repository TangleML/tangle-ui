import { type MouseEvent, useId } from "react";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { tracking } from "@/utils/tracking";

type TrackingAttributes = ReturnType<typeof tracking>;

/** `label` is announced to screen readers; only the pill shows it. */
export type ListItemFlair =
  | {
      kind: "dot";
      label: string;
      tone?: "subdued" | "success" | "warning" | "critical";
      pulse?: boolean;
    }
  | {
      kind: "icon";
      icon: IconName;
      label: string;
      tone?: "subdued" | "success" | "warning" | "critical";
    }
  | {
      kind: "pill";
      label: string;
      tone?: "subdued" | "info" | "success" | "warning" | "critical";
    };

export interface ListItemAction {
  icon: IconName;
  /** Accessible name and tooltip, also used as the key, so keep it unique per item. */
  label: string;
  onClick: () => void;
  tone?: "default" | "success" | "critical";
  disabled?: boolean;
  tracking?: TrackingAttributes;
}

interface ListItemProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  flair?: ListItemFlair;
  actions?: ListItemAction[];
  /** Tints the icon tile when the item needs attention. */
  tone?: "default" | "critical";
  /** The item whose view is currently open. */
  selected?: boolean;
  /** The title stands in for missing content, e.g. "No instructions yet". */
  placeholder?: boolean;
  /** Can't be opened right now; actions stay available. */
  disabled?: boolean;
  /** Omit for display-only items. */
  onOpen?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** `compact` drops the icon tile and puts the subtitle beside the title. */
  density?: "default" | "compact";
  testId?: string;
  tracking?: TrackingAttributes;
}

const TILE_TONE = {
  default: "bg-foreground/8 text-muted-foreground",
  critical: "bg-destructive/10 text-destructive",
} as const;

const DOT_TONE = {
  subdued: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
} as const;

const ICON_TONE = {
  subdued: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  critical: "text-destructive",
} as const;

const PILL_TONE = {
  subdued: "bg-muted text-muted-foreground",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  critical: "bg-destructive/10 text-destructive",
} as const;

const ACTION_TONE = {
  default: "",
  success: "text-success hover:text-success",
  critical: "text-destructive hover:bg-destructive/10 hover:text-destructive",
} as const;

function FlairContent({ flair }: { flair: ListItemFlair }) {
  switch (flair.kind) {
    case "dot":
      return (
        <>
          <span
            className={cn(
              "size-2 rounded-full",
              DOT_TONE[flair.tone ?? "subdued"],
              flair.pulse && "animate-pulse motion-reduce:animate-none",
            )}
          />
          <span className="sr-only">{flair.label}</span>
        </>
      );
    case "icon":
      return (
        <>
          <Icon
            name={flair.icon}
            size="sm"
            aria-hidden
            className={ICON_TONE[flair.tone ?? "subdued"]}
          />
          <span className="sr-only">{flair.label}</span>
        </>
      );
    case "pill":
      return (
        <span
          className={cn(
            "whitespace-nowrap rounded-sm px-1.5 py-0.5 text-xs font-medium",
            PILL_TONE[flair.tone ?? "subdued"],
          )}
        >
          {flair.label}
        </span>
      );
  }
}

/**
 * One item design for every list of openable things: icon tile, title over
 * subtitle, a read-only flair, and actions that take the flair's spot on hover.
 * Until then the actions take no room, so the title truncates at the column's
 * edge rather than short of it.
 * The row's slots take data instead of markup, so call sites can't restyle it.
 */
export function ListItem({
  icon,
  title,
  subtitle,
  flair,
  actions = [],
  tone = "default",
  selected = false,
  placeholder = false,
  disabled = false,
  onOpen,
  density = "default",
  testId,
  tracking,
}: ListItemProps) {
  const flairId = useId();
  const openable = onOpen !== undefined && !disabled;
  const hasActions = actions.length > 0;
  // Translucent rather than a theme token, so selection matches the embedded
  // Tangent lists, which sit on this page's surface with their own palette.
  const rowBackground = selected
    ? "bg-foreground/10"
    : openable && "hover:bg-foreground/5";

  const compact = density === "compact";
  const body = compact ? (
    <>
      <Icon
        name={icon}
        size="sm"
        aria-hidden
        className={cn(
          "shrink-0",
          tone === "critical" ? "text-destructive" : "text-muted-foreground",
        )}
      />
      <Text
        size="sm"
        tone={placeholder ? "subdued" : "inherit"}
        title={title}
        className="min-w-0 flex-1 truncate"
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          size="xs"
          tone="subdued"
          title={subtitle}
          className="max-w-[45%] shrink-0 truncate"
        >
          {subtitle}
        </Text>
      ) : null}
    </>
  ) : (
    <>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-md",
          TILE_TONE[tone],
        )}
      >
        <Icon name={icon} size="lg" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <Text
          size="sm"
          weight="medium"
          tone={placeholder ? "subdued" : "inherit"}
          title={title}
          className="truncate"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text size="xs" tone="subdued" title={subtitle} className="truncate">
            {subtitle}
          </Text>
        ) : null}
      </span>
    </>
  );

  return (
    <li
      className={cn(
        "group/item relative grid w-full grid-cols-[minmax(0,1fr)_auto] rounded-md transition-colors motion-reduce:transition-none",
        rowBackground,
      )}
    >
      {onOpen ? (
        <button
          type="button"
          disabled={disabled}
          aria-current={selected || undefined}
          aria-describedby={flair ? flairId : undefined}
          data-testid={testId}
          onClick={onOpen}
          {...tracking}
          className={cn(
            "flex min-w-0 cursor-pointer items-center text-left outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset disabled:cursor-default disabled:opacity-50",
            compact ? "gap-2 px-2 py-1.5" : "gap-3 p-2",
          )}
        >
          {body}
        </button>
      ) : (
        <div
          className={cn(
            "flex min-w-0 items-center",
            compact ? "gap-2 px-2 py-1.5" : "gap-3 p-2",
          )}
        >
          {body}
        </div>
      )}
      {flair || hasActions ? (
        <div
          className={cn(
            "pointer-events-none relative grid h-5 pe-2 pointer-coarse:flex pointer-coarse:gap-1",
            // Nothing else on a row that can't be opened takes focus, so its
            // actions stay shown instead of waiting on focus to reveal them.
            !openable && "flex gap-1",
            subtitle && !compact ? "mt-2 self-start" : "self-center",
          )}
        >
          {hasActions ? (
            <div
              className={cn(
                "pointer-events-auto hidden items-center justify-end gap-1 [grid-area:1/1] group-focus-within/item:flex group-hover/item:flex pointer-coarse:flex",
                !openable && "flex",
              )}
            >
              {actions.map((action) => (
                <Button
                  key={action.label}
                  variant="ghost"
                  size="min"
                  aria-label={action.label}
                  title={action.label}
                  disabled={action.disabled}
                  onClick={action.onClick}
                  {...action.tracking}
                  className={cn(
                    "size-6",
                    ACTION_TONE[action.tone ?? "default"],
                  )}
                >
                  <Icon name={action.icon} size="sm" aria-hidden />
                </Button>
              ))}
            </div>
          ) : null}
          {flair ? (
            <div
              id={flairId}
              className={cn(
                "flex items-center justify-end transition-opacity duration-150 [grid-area:1/1] motion-reduce:transition-none",
                hasActions &&
                  openable &&
                  "group-hover/item:opacity-0 pointer-fine:group-focus-within/item:opacity-0",
              )}
            >
              <FlairContent flair={flair} />
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

ListItem.displayName = "ListItem";
