import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export const PaginationControls = ({
  currentPage,
  totalPages,
  onPreviousPage,
  onNextPage,
}: PaginationControlsProps) => (
  <InlineStack gap="2" align="space-between" blockAlign="center">
    <Text as="span" size="xs" tone="subdued">
      Page {currentPage} of {totalPages}
    </Text>
    <InlineStack gap="2">
      <Button
        variant="outline"
        size="sm"
        onClick={onPreviousPage}
        disabled={currentPage === 1}
      >
        <Icon name="ChevronLeft" size="sm" />
        Previous
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onNextPage}
        disabled={currentPage === totalPages}
      >
        Next
        <Icon name="ChevronRight" size="sm" />
      </Button>
    </InlineStack>
  </InlineStack>
);
