import { observer } from "mobx-react-lite";

import logo from "/Tangle_Icon_White.png";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { navigationStore } from "@/routes/EditorV2/store/navigationStore";
import { restoreWindow } from "@/routes/EditorV2/windows/windows.actions";
import { TOP_NAV_HEIGHT } from "@/utils/constants";

import { AppMenuActions } from "./components/AppMenuActions";
import { AutoSaveIndicator } from "./components/AutoSaveIndicator";
import { ComponentsLibraryMenu } from "./components/ComponentsLibraryMenu";
import { FileMenu } from "./components/FileMenu";
import { MenuTriggerButton } from "./components/MenuTriggerButton";
import { MovePipelineToFolderButton } from "./components/MovePipelineToFolderButton";
import { ViewMenu } from "./components/ViewMenu";

export const EditorMenuBar = observer(function EditorMenuBar() {
  const spec = navigationStore.activeSpec;
  const pipelineName = spec?.name ?? "Untitled pipeline";

  return (
    <div
      className="w-full bg-stone-900 px-3 py-1 md:px-4"
      style={{ height: `${TOP_NAV_HEIGHT}px` }}
    >
      <InlineStack
        align="space-between"
        blockAlign="stretch"
        wrap="nowrap"
        className="h-full"
      >
        <InlineStack
          gap="3"
          wrap="nowrap"
          align="start"
          blockAlign="center"
          className="min-w-0"
        >
          <Link href="/" aria-label="Home" variant="block" className="shrink-0">
            <img
              src={logo}
              alt="logo"
              className="h-8 cursor-pointer shrink-0"
            />
          </Link>

          <BlockStack gap="0" className="min-w-0">
            <Text
              as="span"
              size="sm"
              weight="semibold"
              className="text-white truncate max-w-64 lg:max-w-md leading-tight ml-1"
            >
              {pipelineName}
            </Text>

            <InlineStack gap="0" wrap="nowrap" blockAlign="center">
              <FileMenu />
              <ViewMenu />
              <MenuTriggerButton
                onClick={() => restoreWindow("pipeline-details")}
              >
                Notes
              </MenuTriggerButton>
              <MenuTriggerButton disabled>Runs</MenuTriggerButton>
              <ComponentsLibraryMenu />
            </InlineStack>
          </BlockStack>

          <InlineStack
            gap="2"
            wrap="nowrap"
            align="start"
            blockAlign="center"
            className="shrink-0 ml-1"
            data-testid="status-indicators"
          >
            <Separator orientation="vertical" />
            <MovePipelineToFolderButton pipelineName={pipelineName} />
            <AutoSaveIndicator />
          </InlineStack>
        </InlineStack>

        <AppMenuActions />
      </InlineStack>
    </div>
  );
});
