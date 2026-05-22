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
import { useTourMode } from "@/providers/TourProvider";
import { promoteTourPipelineName } from "@/providers/TourProvider/tourPipelineLifecycle";
import { APP_ROUTES } from "@/routes/router";

const TOUR_POPUP_OPEN_FALLBACK_LABEL = "Resume tour";
import { usePipelineRename } from "@/routes/v2/pages/Editor/hooks/usePipelineRename";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { AppMenuActions } from "@/routes/v2/shared/components/AppMenuActions";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
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
  const storage = usePipelineStorage();
  const navigate = useNavigate();
  const { isOpen: tourPopupOpen, setIsOpen: setTourPopupOpen } = useTour();

  const spec = navigation.activeSpec;
  const pipelineNameFromSpec = spec?.name ?? "Untitled pipeline";
  const displayName =
    tourMode?.tour.displayName ?? tourMode?.tour.id ?? pipelineNameFromSpec;

  const displayMenu = Boolean(pipelineFile.activePipelineFile);
  const [renameOpen, setRenameOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);

  // While the popover is showing, the tour itself is driving the user.
  // Off-popover actions (save, exit, resume) only make sense once the
  // popover has been dismissed.
  const showTourActions = Boolean(tourMode) && !tourPopupOpen;

  const handleTourSaveAs = async (name: string) => {
    if (!tourMode) return;
    const { newName } = await promoteTourPipelineName(
      storage,
      tourMode.tempPipelineName,
      name,
    );
    tourMode.markPipelinePromoted();
    const file = await storage.resolvePipelineByName(newName);
    void navigate({
      to: APP_ROUTES.EDITOR_V2_PIPELINE,
      params: { pipelineName: newName },
      search: file?.id ? { fileId: file.id } : {},
    });
  };

  const handleResumeTour = () => {
    setTourPopupOpen(true);
  };

  const handleExitTour = () => {
    void navigate({ to: APP_ROUTES.LEARN_TOURS });
  };

  return (
    <div
      className="w-full bg-stone-900 px-3 py-1 md:px-4"
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

        <InlineStack
          gap="2"
          wrap="nowrap"
          blockAlign="center"
          className="shrink-0"
          data-tour="editor-top-bar-actions"
        >
          {displayMenu && (
            <>
              {showTourActions && tourMode && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleResumeTour}
                    aria-label={TOUR_POPUP_OPEN_FALLBACK_LABEL}
                    {...tracking("v2.pipeline_editor.tour.resume")}
                  >
                    <Icon name="Play" size="sm" />
                    Resume tour
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSaveAsOpen(true)}
                    {...tracking("v2.pipeline_editor.tour.save_as_pipeline")}
                  >
                    <Icon name="SaveAll" size="sm" />
                    Save as new pipeline
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleExitTour}
                    {...tracking("v2.pipeline_editor.tour.exit")}
                  >
                    <Icon name="X" size="sm" />
                    Exit tour
                  </Button>
                  <PipelineNameDialog
                    open={saveAsOpen}
                    onOpenChange={setSaveAsOpen}
                    title="Save tour pipeline"
                    description="Convert this tour pipeline into a regular pipeline you can keep editing."
                    initialName={tourMode.tour.displayName ?? tourMode.tour.id}
                    onSubmit={handleTourSaveAs}
                    submitButtonText="Save"
                  />
                  <div className="w-px h-5 bg-stone-700" />
                </>
              )}
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
