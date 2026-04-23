import { observer } from "mobx-react-lite";
import { useState } from "react";

import logo from "/Tangle_Icon_White.png";
import { PipelineNameDialog } from "@/components/shared/Dialogs";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/typography";
import { usePipelineRename } from "@/routes/v2/pages/Editor/hooks/usePipelineRename";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { AppMenuActions } from "@/routes/v2/shared/components/AppMenuActions";
import { MenuTriggerButton } from "@/routes/v2/shared/components/MenuTriggerButton";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { TOP_NAV_HEIGHT } from "@/utils/constants";

import { AutoSaveIndicator } from "./components/AutoSaveIndicator";
import { ComponentsLibraryMenu } from "./components/ComponentsLibraryMenu";
import { FileMenu } from "./components/FileMenu";
import { NodeMenu } from "./components/NodeMenu";
import { QuickRunButton } from "./components/QuickRunButton";
import { RunsMenu } from "./components/RunsMenu";
import { ViewMenu } from "./components/ViewMenu";
import { WindowsMenu } from "./components/WindowsMenu";

export const EditorMenuBar = observer(function EditorMenuBar() {
  const { navigation, windows } = useSharedStores();
  const { pipelineFile } = useEditorSession();
  const handlePipelineRename = usePipelineRename();
  const spec = navigation.activeSpec;
  const pipelineName = spec?.name ?? "Untitled pipeline";

  const displayMenu = Boolean(pipelineFile.activePipelineFile);
  const [renameOpen, setRenameOpen] = useState(false);

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

          {displayMenu && (
            <BlockStack gap="0" className="min-w-0">
              <InlineStack
                gap="1"
                blockAlign="center"
                wrap="nowrap"
                className="group min-w-0 ml-1"
              >
                <Text
                  as="span"
                  size="sm"
                  weight="semibold"
                  className="text-white truncate max-w-64 lg:max-w-md leading-tight"
                >
                  {pipelineName}
                </Text>
                <button
                  type="button"
                  className="shrink-0 text-stone-400 hover:text-white cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setRenameOpen(true)}
                >
                  <Icon name="Pencil" size="xs" />
                </button>
              </InlineStack>
              <PipelineNameDialog
                open={renameOpen}
                onOpenChange={setRenameOpen}
                title="Rename Pipeline"
                initialName={pipelineName}
                onSubmit={handlePipelineRename}
                submitButtonText="Rename"
                isSubmitDisabled={(name) => name === pipelineName}
              />

              <InlineStack gap="0" wrap="nowrap" blockAlign="center">
                <FileMenu />
                <ViewMenu />
                <RunsMenu />
                <MenuTriggerButton
                  onClick={() => windows.restoreWindow("pipeline-details")}
                >
                  Notes
                </MenuTriggerButton>
                <ComponentsLibraryMenu />
                <WindowsMenu />
                <NodeMenu />
              </InlineStack>
            </BlockStack>
          )}
        </InlineStack>

        <InlineStack
          gap="2"
          wrap="nowrap"
          blockAlign="center"
          className="shrink-0"
        >
          {displayMenu && (
            <>
              <QuickRunButton />
              <AutoSaveIndicator />
              <div className="w-px h-5 bg-stone-700" />
            </>
          )}
          <AppMenuActions />
        </InlineStack>
      </InlineStack>
    </div>
  );
});
