import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

import { useRunProjectContext } from "./useRunProjectContext";

export function ProjectRunContextChip() {
  const { projectId, projectName, dismiss } = useRunProjectContext();

  if (!projectId) {
    return null;
  }

  return (
    <Badge size="sm" variant="secondary" className="max-w-full gap-1.5">
      <InlineStack
        gap="1"
        blockAlign="center"
        wrap="nowrap"
        className="min-w-0"
      >
        <Icon name="Folder" size="xs" aria-hidden="true" />
        <Text size="xs" className="truncate">
          {projectName
            ? `Runs go to ${projectName}`
            : "Runs go to this project"}
        </Text>
      </InlineStack>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Stop sending runs to this project"
        title="Stop sending runs to this project"
        className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
        {...tracking("projects.dismiss_run_context")}
      >
        <Icon name="X" size="xs" />
      </button>
    </Badge>
  );
}
