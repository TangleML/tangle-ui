import { observer } from "mobx-react-lite";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/typography";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { tracking } from "@/utils/tracking";

import { triggerSubmitRun, triggerSubmitWithArguments } from "./QuickRunButton";

export const RunsMenu = observer(function RunsMenu() {
  const { track } = useAnalytics();
  const { navigation } = useSharedStores();
  const rootSpec = navigation.rootSpec;
  const allIssues = rootSpec?.allValidationIssues ?? [];
  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const hasErrors = errorCount > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTriggerButton {...tracking("v2.pipeline_editor.runs_menu")}>
          Runs
        </MenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2}>
        <DropdownMenuItem
          onSelect={() => {
            track("v2.pipeline_editor.runs_menu.submit_run.click");
            triggerSubmitRun();
          }}
          disabled={hasErrors}
        >
          <Icon name="Play" size="sm" />
          Submit Run
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            track("v2.pipeline_editor.runs_menu.submit_with_arguments.click");
            triggerSubmitWithArguments();
          }}
          disabled={hasErrors}
        >
          <Icon name="Split" size="sm" className="rotate-90" />
          Submit with Arguments
        </DropdownMenuItem>
        {errorCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <Text size="xs" className="text-red-500">
                {errorCount} validation {errorCount === 1 ? "issue" : "issues"}
              </Text>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
