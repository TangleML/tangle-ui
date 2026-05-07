import { observer } from "mobx-react-lite";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import {
  navigateAndSelectIssue,
  sameValidationIssue,
} from "@/routes/v2/shared/store/focus.actions";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { ValidationIssueResolutionCard } from "./ValidationIssueResolutionCard";

export const IssueResolutionWindowContent = observer(
  function IssueResolutionWindowContent() {
    const { editor, navigation } = useSharedStores();
    const rootSpec = navigation.rootSpec;
    const issues = rootSpec?.allValidationIssues ?? [];

    const selected = editor.selectedValidationIssue;
    const selectedIndex = selected
      ? issues.findIndex((i) => sameValidationIssue(i, selected))
      : -1;
    const currentIndex =
      selectedIndex >= 0 ? selectedIndex : issues.length > 0 ? 0 : -1;
    const currentIssue = currentIndex >= 0 ? issues[currentIndex] : null;

    useEffect(() => {
      const spec = navigation.rootSpec;
      if (!spec) {
        return;
      }
      const list = spec.allValidationIssues;
      if (list.length === 0) {
        editor.setSelectedValidationIssue(null);
        return;
      }
      const sel = editor.selectedValidationIssue;
      if (!sel || !list.some((i) => sameValidationIssue(i, sel))) {
        navigateAndSelectIssue(editor, navigation, list[0]);
      }
    }, [
      navigation.rootSpec?.$id,
      navigation.rootSpec?.allValidationIssues.length,
      editor.selectedValidationIssue,
    ]);

    const handlePrev = () => {
      if (currentIndex <= 0) {
        return;
      }
      navigateAndSelectIssue(editor, navigation, issues[currentIndex - 1]);
    };

    const handleNext = () => {
      if (currentIndex < 0 || currentIndex >= issues.length - 1) {
        return;
      }
      navigateAndSelectIssue(editor, navigation, issues[currentIndex + 1]);
    };

    if (!rootSpec) {
      return (
        <BlockStack className="p-3" gap="2">
          <Text size="xs" tone="subdued">
            No pipeline loaded
          </Text>
        </BlockStack>
      );
    }

    if (issues.length === 0) {
      return (
        <BlockStack className="p-3" gap="2" align="center" inlineAlign="center">
          <Icon name="CircleCheck" size="lg" className="text-slate-300" />
          <Text size="xs" tone="subdued" className="text-center">
            No issues to fix
          </Text>
        </BlockStack>
      );
    }

    if (!currentIssue) {
      return null;
    }

    const positionLabel = `${currentIndex + 1} of ${issues.length}`;

    return (
      <BlockStack
        fill
        className="min-h-0"
        data-testid="issue-resolution-window"
      >
        <InlineStack
          gap="2"
          blockAlign="center"
          className="shrink-0 w-full border-b border-border p-2"
        >
          <Button
            variant="outline"
            size="sm"
            aria-label="Previous issue"
            disabled={currentIndex <= 0}
            onClick={handlePrev}
          >
            <Icon name="ChevronLeft" size="sm" />
          </Button>
          <Text size="xs" tone="subdued" className="min-w-0 flex-1 text-center">
            {positionLabel}
          </Text>
          <Button
            variant="outline"
            size="sm"
            aria-label="Next issue"
            disabled={currentIndex >= issues.length - 1}
            onClick={handleNext}
          >
            <Icon name="ChevronRight" size="sm" />
          </Button>
        </InlineStack>
        <BlockStack className="min-h-0 flex-1 overflow-hidden">
          <ValidationIssueResolutionCard issue={currentIssue} />
        </BlockStack>
      </BlockStack>
    );
  },
);
