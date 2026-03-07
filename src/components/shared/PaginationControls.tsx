import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onReset: () => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
  onReset,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  return (
    <InlineStack
      gap="2"
      align="space-between"
      blockAlign="center"
      className="w-full"
    >
      <InlineStack gap="2" blockAlign="center">
        <Button
          variant="outline"
          onClick={onReset}
          disabled={currentPage === 1}
        >
          <Icon name="ChevronFirst" />
        </Button>
        <Button
          variant="outline"
          onClick={onPreviousPage}
          disabled={!hasPreviousPage}
        >
          <Icon name="ChevronLeft" />
          Previous
        </Button>
      </InlineStack>
      <Text size="sm" tone="subdued">
        Page {currentPage} of {totalPages}
      </Text>
      <Button variant="outline" onClick={onNextPage} disabled={!hasNextPage}>
        Next
        <Icon name="ChevronRight" />
      </Button>
    </InlineStack>
  );
}
