import { useTour } from "@reactour/tour";
import { useNavigate } from "@tanstack/react-router";
import { observer } from "mobx-react-lite";
import { useState } from "react";

import logo from "/Tangle_Icon_White.png";
import { PipelineNameDialog } from "@/components/shared/Dialogs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/typography";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import { APP_ROUTES } from "@/routes/router";
import { usePipelineRename } from "@/routes/v2/pages/Editor/hooks/usePipelineRename";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { AppMenuActions } from "@/routes/v2/shared/components/AppMenuActions";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { TOP_NAV_HEIGHT } from "@/utils/constants";
import { tracking } from "@/utils/tracking";

import { AutoSaveIndicator } from "./components/AutoSaveIndicator";
import { ComponentsLibraryMenu } from "./components/ComponentsLibraryMenu";
import { FileMenu } from "./components/FileMenu";
import { NodeMenu } from "./components/NodeMenu";
import { QuickRunButton } from "./components/QuickRunButton";
import { RunsMenu } from "./components/RunsMenu";
import { ViewMenu } from "./components/ViewMenu";
import { WindowsMenu } from "./components/WindowsMenu";

export const EditorMenuBar = observer(function EditorMenuBar() {
  const { navigation } = useSharedStores();
  const { pipelineFile } = useEditorSession();
  const handlePipelineRename = usePipelineRename();
  const tourMode = useTourMode();
  const { setIsOpen: setTourPopupOpen } = useTour();
  const navigate = useNavigate();

  const spec = navigation.activeSpec;
  const pipelineNameFromSpec = spec?.name ?? "Untitled pipeline";
  const displayName =
    tourMode?.tour.displayName ?? tourMode?.tour.id ?? pipelineNameFromSpec;

  const displayMenu = Boolean(pipelineFile.activePipelineFile);
  const [renameOpen, setRenameOpen] = useState(false);

  const handleExitTour = () => {
    setTourPopupOpen(false);
    void navigate({ to: APP_ROUTES.LEARN_TOURS });
  };

  return (
    <div
      className="relative w-full bg-stone-900 px-3 py-1 md:px-4"
      style={{ height: `${TOP_NAV_HEIGHT}px` }}
      data-tour="editor-top-bar"
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
          data-tour="editor-top-bar-left"
        >
          <Link
            href="/"
            aria-label="Home"
            variant="block"
            className="shrink-0"
            {...tracking("v2.pipeline_editor.menubar.home")}
          >
            <img
              src={logo}
              alt="logo"
              className="h-8 cursor-pointer shrink-0"
            />
          </Link>

          {displayMenu && (
            <BlockStack className="min-w-0">
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
                  {displayName}
                </Text>
                {tourMode && (
                  <Badge size="sm" variant="default" className="shrink-0">
                    Tour
                  </Badge>
                )}
                {!tourMode && (
                  <Button
                    variant="ghost"
                    size="inline-xs"
                    className="shrink-0 p-0 text-stone-400 hover:bg-transparent hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setRenameOpen(true)}
                    {...tracking("v2.pipeline_editor.menubar.rename_pipeline")}
                  >
                    <Icon name="Pencil" size="xs" />
                  </Button>
                )}
              </InlineStack>
              {!tourMode && (
                <PipelineNameDialog
                  open={renameOpen}
                  onOpenChange={setRenameOpen}
                  title="Rename Pipeline"
                  initialName={pipelineNameFromSpec}
                  onSubmit={handlePipelineRename}
                  submitButtonText="Rename"
                  isSubmitDisabled={(name) => name === pipelineNameFromSpec}
                  excludeNames={[pipelineNameFromSpec]}
                />
              )}

              <InlineStack
                wrap="nowrap"
                blockAlign="center"
                data-tour="editor-menu-items"
              >
                <FileMenu />
                <ViewMenu />
                <RunsMenu />
                <ComponentsLibraryMenu />
                <WindowsMenu />
                <NodeMenu />
              </InlineStack>
            </BlockStack>
          )}
        </InlineStack>

        {tourMode && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleExitTour}
            aria-label="Exit tour"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[100001] text-background/80 hover:text-background hover:bg-transparent"
            {...tracking("v2.pipeline_editor.tour.exit")}
          >
            <Icon name="X" size="sm" />
            Exit Tour
          </Button>
        )}

        <InlineStack
          gap="2"
          wrap="nowrap"
          blockAlign="center"
          className="shrink-0"
          data-tour="editor-top-bar-actions"
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
