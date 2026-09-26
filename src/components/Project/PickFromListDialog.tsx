import { type ReactNode, useState } from "react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import type { IconName } from "@/components/ui/icon";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

export interface PickableItem {
  id: string;
  label: string;
  alreadyAdded: boolean;
}

interface PickFromListDialogProps {
  title: string;
  helpText: ReactNode;
  noun: string;
  icon: IconName;
  items: PickableItem[] | undefined;
  error: Error | null;
  isPending: boolean;
  isAdding: boolean;
  emptyTitle: string;
  emptyDescription: string;
  selectTracking: string;
  cancelTracking: string;
  onPick: (id: string) => void;
  onClose: () => void;
}

/**
 * The shell shared by the two "pick one thing to file against another" dialogs
 * — a pipeline for a project, and a project for a pipeline. Only the items,
 * the wording and what picking does differ between them.
 */
export function PickFromListDialog({
  title,
  helpText,
  noun,
  icon,
  items,
  error,
  isPending,
  isAdding,
  emptyTitle,
  emptyDescription,
  selectTracking,
  cancelTracking,
  onPick,
  onClose,
}: PickFromListDialogProps) {
  const [query, setQuery] = useState("");

  const close = () => {
    setQuery("");
    onClose();
  };

  const all = items ?? [];
  const matches = all.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : close())}>
      <DialogContent className="flex max-h-[80vh] flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <BlockStack gap="4" className="min-h-0">
          <Text size="sm" tone="subdued">
            {helpText}
          </Text>

          {all.length > 0 && (
            <div className="relative">
              <Icon
                name="Search"
                size="sm"
                className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onEscape={() => setQuery("")}
                placeholder={`Search ${noun}s`}
                aria-label={`Search ${noun}s`}
                className="pl-7"
                autoFocus
              />
            </div>
          )}

          {isPending && (
            <InlineStack gap="2" blockAlign="center">
              <Spinner /> Loading...
            </InlineStack>
          )}

          {error && (
            <InfoBox title={`Error loading ${noun}s`} variant="error">
              {error.message}
            </InfoBox>
          )}

          {items && all.length === 0 && (
            <EmptyState
              icon={icon}
              placement="start"
              title={emptyTitle}
              description={emptyDescription}
            />
          )}

          {all.length > 0 && matches.length === 0 && (
            <Text size="sm" tone="subdued">
              {`No ${noun}s match that.`}
            </Text>
          )}

          <BlockStack gap="1" className="min-h-0 flex-1 overflow-y-auto">
            {matches.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                className="h-auto w-full justify-start py-2"
                disabled={item.alreadyAdded || isAdding}
                onClick={() => onPick(item.id)}
                {...tracking(selectTracking)}
              >
                <InlineStack
                  gap="2"
                  blockAlign="center"
                  wrap="nowrap"
                  className="w-full"
                >
                  <Icon name={icon} size="xs" className="shrink-0" />
                  <Text size="sm" className="flex-1 truncate text-left">
                    {item.label}
                  </Text>
                  {item.alreadyAdded && (
                    <Text size="xs" tone="subdued">
                      Added
                    </Text>
                  )}
                </InlineStack>
              </Button>
            ))}
          </BlockStack>
        </BlockStack>

        <DialogFooter className="w-full">
          <InlineStack gap="2" className="w-full" align="end">
            <Button
              variant="outline"
              onClick={close}
              {...tracking(cancelTracking)}
            >
              Cancel
            </Button>
          </InlineStack>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
