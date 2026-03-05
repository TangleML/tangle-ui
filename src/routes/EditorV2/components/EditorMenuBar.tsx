import { useNavigate } from "@tanstack/react-router";
import { observer } from "mobx-react-lite";
import { generate } from "random-words";
import { useEffect, useRef, useState } from "react";

import logo from "/Tangle_Icon_White.png";
import { PipelineSection } from "@/components/Home/PipelineSection/PipelineSection";
import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { TopBarAuthentication } from "@/components/shared/Authentication/TopBarAuthentication";
import BackendStatus from "@/components/shared/BackendStatus";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import ImportPipeline from "@/components/shared/ImportPipeline";
import { ManageSecretsButton } from "@/components/shared/SecretsManagement/ManageSecretsButton";
import { PersonalPreferences } from "@/components/shared/Settings/PersonalPreferences";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { EDITOR_PATH } from "@/routes/router";
import { writeComponentToFileListFromText } from "@/utils/componentStore";
import {
  defaultPipelineYamlWithName,
  DOCUMENTATION_URL,
  IS_GITHUB_PAGES,
  TOP_NAV_HEIGHT,
  USER_PIPELINES_LIST_NAME,
} from "@/utils/constants";

import { autoSaveStore } from "../store/autoSaveStore";
import {
  navigationStore,
  setRequestedPipelineName,
} from "../store/navigationStore";
import { restoreWindow } from "../windows/windowStore";
import { AutoSaveIndicator } from "./AutoSaveIndicator";

const MenuTriggerButton = ({
  children,
  ...props
}: React.ComponentProps<typeof Button>) => (
  <Button
    variant="ghost"
    size="sm"
    className="h-6 px-1.5 text-xs text-white/80 hover:text-white hover:bg-stone-700 rounded-sm font-normal"
    {...props}
  >
    {children}
  </Button>
);

function FileMenu() {
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const importTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (importOpen) {
      importTriggerRef.current?.click();
      setImportOpen(false);
    }
  }, [importOpen]);

  const handleNewPipeline = async () => {
    const name = (generate(4) as string[]).join(" ");
    const componentText = defaultPipelineYamlWithName(name);
    await writeComponentToFileListFromText(
      USER_PIPELINES_LIST_NAME,
      name,
      componentText,
    );
    navigate({
      to: `${EDITOR_PATH}/${encodeURIComponent(name)}`,
      reloadDocument: !IS_GITHUB_PAGES,
    });
  };

  const handlePipelineClick = (name: string) => {
    setRequestedPipelineName(name);
    setOpenDialogOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <MenuTriggerButton>File</MenuTriggerButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={2}>
          <DropdownMenuItem onClick={() => setOpenDialogOpen(true)}>
            <Icon name="FolderOpen" size="sm" />
            Open
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void autoSaveStore.save()}>
            <Icon name="Save" size="sm" />
            Save
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Icon name="SaveAll" size="sm" />
            Save as
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleNewPipeline}>
            <Icon name="Plus" size="sm" />
            New pipeline
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setImportOpen(true)}>
            <Icon name="Upload" size="sm" />
            Import
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Icon name="FileDown" size="sm" />
            Export
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[95vw] w-full max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Open Pipeline</DialogTitle>
          </DialogHeader>
          <PipelineSection onPipelineClick={handlePipelineClick} />
        </DialogContent>
      </Dialog>

      <ImportPipeline
        triggerComponent={
          <button
            ref={importTriggerRef}
            className="sr-only"
            aria-hidden
            tabIndex={-1}
          />
        }
      />
    </>
  );
}

function ViewMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTriggerButton>View</MenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2}>
        <DropdownMenuItem disabled>
          <Icon name="LayoutDashboard" size="sm" />
          Auto-layout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ComponentsLibraryMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTriggerButton>Components</MenuTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={2}>
        <DropdownMenuItem onClick={() => restoreWindow("component-library")}>
          <Icon name="Library" size="sm" />
          Explore library
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => restoreWindow("component-library")}>
          <Icon name="User" size="sm" />
          My components
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Icon name="Plus" size="sm" />
          New component
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppMenuActions() {
  const requiresAuthorization = isAuthorizationRequired();

  return (
    <InlineStack
      gap="2"
      wrap="nowrap"
      className="shrink-0"
      data-testid="app-menu-actions"
    >
      <BackendStatus />
      <PersonalPreferences />
      <ManageSecretsButton />
      <Link href={DOCUMENTATION_URL} target="_blank" rel="noopener noreferrer">
        <TooltipButton tooltip="Documentation">
          <Icon name="CircleQuestionMark" />
        </TooltipButton>
      </Link>
      {requiresAuthorization && <TopBarAuthentication />}
    </InlineStack>
  );
}

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
        {/* Columns A + B + C */}
        <InlineStack
          gap="3"
          wrap="nowrap"
          align="start"
          blockAlign="center"
          className="min-w-0"
        >
          {/* Column A: Logo */}
          <Link href="/" aria-label="Home" variant="block" className="shrink-0">
            <img
              src={logo}
              alt="logo"
              className="h-8 cursor-pointer shrink-0"
            />
          </Link>

          {/* Column B: Name + Menus */}
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

          {/* Column C: Status indicators */}
          <InlineStack
            gap="2"
            wrap="nowrap"
            align="start"
            blockAlign="center"
            className="shrink-0 ml-1"
            data-testid="status-indicators"
          >
            <Separator orientation="vertical" />
            <Button variant="ghost" size="icon">
              <Icon name="Folder" size="sm" className="text-stone-400" />
            </Button>
            <AutoSaveIndicator />
          </InlineStack>
        </InlineStack>

        {/* Column D: Actions */}
        <AppMenuActions />
      </InlineStack>
    </div>
  );
});
