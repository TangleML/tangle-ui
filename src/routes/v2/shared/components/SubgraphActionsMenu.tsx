import { observer } from "mobx-react-lite";
import { type ReactNode, useState } from "react";

import { CodeViewer } from "@/components/shared/CodeViewer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useToastNotification from "@/hooks/useToastNotification";
import { serializeComponentSpecToYaml } from "@/models/componentSpec";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { downloadYamlFromComponentText } from "@/utils/URL";

interface SubgraphActionsMenuProps {
  extraItems?: ReactNode;
}

export const SubgraphActionsMenu = observer(function SubgraphActionsMenu({
  extraItems,
}: SubgraphActionsMenuProps) {
  const { navigation } = useSharedStores();
  const notify = useToastNotification();
  const [showCodeViewer, setShowCodeViewer] = useState(false);

  const spec = navigation.activeSpec;

  if (!spec || navigation.navigationDepth === 0) {
    return null;
  }

  const subgraphName = spec.name || "subgraph";

  const handleViewYaml = () => setShowCodeViewer(true);

  const handleDownloadYaml = () => {
    downloadYamlFromComponentText(
      serializeComponentSpecToYaml(spec),
      subgraphName,
    );
  };

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(serializeComponentSpecToYaml(spec)).then(
      () => notify("YAML copied to clipboard", "success"),
      (err) => notify("Failed to copy YAML: " + err, "error"),
    );
  };

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="min"
                aria-label="Subgraph actions"
                data-testid="subgraph-actions-menu-trigger"
              >
                <Icon name="EllipsisVertical" size="sm" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Subgraph actions</TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end">
          {extraItems && (
            <>
              {extraItems}
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem onClick={handleViewYaml}>
            <Icon name="FileCode" size="sm" />
            View YAML
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleDownloadYaml}>
            <Icon name="Download" size="sm" />
            Download YAML
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleCopyYaml}>
            <Icon name="Clipboard" size="sm" />
            Copy YAML
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {showCodeViewer && (
        <CodeViewer
          code={serializeComponentSpecToYaml(spec)}
          language="yaml"
          filename={subgraphName}
          fullscreen
          onClose={() => setShowCodeViewer(false)}
        />
      )}
    </>
  );
});
