import { type MouseEvent, type ReactNode, useId } from "react";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { StatusDot, type StatusDotTone } from "@/components/ui/status-dot";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { tracking } from "@/utils/tracking";

type TrackingAttributes = ReturnType<typeof tracking>;

/** `label` is announced to screen readers in place of what the flair shows. */
export type ListItemFlair =
  | { kind: "dot"; label: string; tone?: StatusDotTone; pulse?: boolean }
  | { kind: "spinner"; label: string }
  | { kind: "icon"; icon: IconName; label: string; tone?: StatusDotTone };

export interface ListItemAction {
  icon: IconName;
  /** Accessible name and tooltip, also used as the key, so keep it unique per item. */
  label: string;
  onClick: () => void;
  tracking?: TrackingAttributes;
}

interface ListItemProps {
  /** Without one, the title lines up under the titles of rows that have one. */
  icon?: IconName;
  title: string;
  subtitle?: string;
  flair?: ListItemFlair;
  actions?: ListItemAction[];
  /** A dropdown menu's trigger, shown with the actions. */
  menu?: ReactNode;
  /** The item whose view is currently open. */
  selected?: boolean;
  /** For a row heading a group it opens and closes; its title reads heavier. */
  expanded?: boolean;
  tooltip?: string;
  onOpen: (event: MouseEvent<HTMLButtonElement>) => void;
  tracking?: TrackingAttributes;
  /** `div` for a row that heads a group inside another list's item. */
  as?: "li" | "div";
}

const ICON_TONE = {
  subdued: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  critical: "text-destructive",
} as const;

function FlairContent({ flair }: { flair: ListItemFlair }) {
  return (
    <>
      {flair.kind === "dot" && (
        <StatusDot tone={flair.tone} pulse={flair.pulse} />
      )}
      {flair.kind === "spinner" && (
        <Spinner size={12} className="motion-reduce:animate-none" />
      )}
      {flair.kind === "icon" && (
        <Icon
          name={flair.icon}
          size="sm"
          aria-hidden
          className={ICON_TONE[flair.tone ?? "subdued"]}
        />
      )}
      <span className="sr-only">{flair.label}</span>
    </>
  );
}

/**
 * One row design for every list of openable things: an icon, the title with
 * a subtitle beside it, a read-only flair, and actions that take the flair's
 * spot on hover. Until then the actions take no room, so the title truncates
 * at the column's edge rather than short of it. A menu among the actions
 * stays shown while it's open.
 * The row's slots take data instead of markup, so call sites can't restyle it.
 */
export function ListItem({
  icon,
  title,
  subtitle,
  flair,
  actions = [],
  menu,
  selected = false,
  expanded,
  tooltip,
  onOpen,
  tracking,
  as: Row = "li",
}: ListItemProps) {
  const flairId = useId();
  const hasActions = actions.length > 0 || menu !== undefined;

  return (
    <Row
      className={cn(
        "group/item relative grid w-full grid-cols-[minmax(0,1fr)_auto] rounded-md transition-colors motion-reduce:transition-none",
        // Translucent rather than a theme token, so selection matches the
        // embedded Tangent lists, which sit on this page's surface with their
        // own palette.
        selected ? "bg-foreground/10" : "hover:bg-foreground/5",
      )}
    >
      <button
        type="button"
        aria-current={selected || undefined}
        aria-expanded={expanded}
        aria-describedby={flair ? flairId : undefined}
        title={tooltip}
        onClick={onOpen}
        {...tracking}
        className={cn(
          "flex min-w-0 cursor-pointer items-center gap-2 py-1.5 pe-2 text-left outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset",
          icon ? "ps-2" : "ps-8",
        )}
      >
        {icon && (
          <Icon
            name={icon}
            size="sm"
            aria-hidden
            className="shrink-0 text-muted-foreground"
          />
        )}
        <Text
          size="sm"
          weight={expanded === undefined ? undefined : "medium"}
          tone="inherit"
          title={tooltip ? undefined : title}
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
      </button>
      {flair || hasActions ? (
        <div className="pointer-events-none relative grid h-5 self-center pe-2 pointer-coarse:flex pointer-coarse:gap-1">
          {hasActions ? (
            <div className="pointer-events-auto hidden items-center justify-end gap-1 [grid-area:1/1] group-focus-within/item:flex group-hover/item:flex has-[[data-state=open]]:flex pointer-coarse:flex">
              {actions.map((action) => (
                <Button
                  key={action.label}
                  variant="subtle"
                  size="icon-xs"
                  aria-label={action.label}
                  title={action.label}
                  onClick={action.onClick}
                  {...action.tracking}
                >
                  <Icon name={action.icon} size="sm" aria-hidden />
                </Button>
              ))}
              {menu}
            </div>
          ) : null}
          {flair ? (
            <div
              id={flairId}
              className={cn(
                "flex items-center justify-end transition-opacity duration-150 [grid-area:1/1] motion-reduce:transition-none",
                hasActions &&
                  "group-hover/item:opacity-0 pointer-fine:group-focus-within/item:opacity-0",
              )}
            >
              <FlairContent flair={flair} />
            </div>
          ) : null}
        </div>
      ) : null}
    </Row>
  );
}

ListItem.displayName = "ListItem";
