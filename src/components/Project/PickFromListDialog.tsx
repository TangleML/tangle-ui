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
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

import { PickerOption } from "./PickerOption";
import { PickerSearchField } from "./PickerSearchField";

interface PickableItem {
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
  search?: { value: string; onChange: (value: string) => void };
  pagination?: ReactNode;
}

/** Shared by "pick a pipeline for a project" and its inverse. */
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
  search,
  pagination,
}: PickFromListDialogProps) {
  const [query, setQuery] = useState("");

  const close = () => {
    setQuery("");
    onClose();
  };

  const all = items ?? [];
  const matches = search
    ? all
    : all.filter((item) =>
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

          {(search || all.length > 0) && (
            <PickerSearchField
              label={`Search ${noun}s`}
              value={search?.value ?? query}
              onChange={search?.onChange ?? setQuery}
            />
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
              <PickerOption
                key={item.id}
                icon={icon}
                label={item.label}
                detail={item.alreadyAdded ? "Added" : undefined}
                disabled={item.alreadyAdded || isAdding}
                onClick={() => onPick(item.id)}
                trackingId={selectTracking}
              />
            ))}
          </BlockStack>
        </BlockStack>

        {pagination}

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
