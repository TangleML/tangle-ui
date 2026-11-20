import { useMutation } from "@tanstack/react-query";
import { PackagePlus } from "lucide-react";
import { type ChangeEvent, type ReactNode, useCallback, useState } from "react";

import { ComponentEditorDialog } from "@/components/shared/ComponentEditor/ComponentEditorDialog";
import { NewComponentTemplateSelector } from "@/components/shared/ComponentEditor/components/NewComponentTemplateSelector";
import type { SupportedTemplate } from "@/components/shared/ComponentEditor/types";
import {
  FilePicker,
  type PickOutcome,
  YAML_FILE_ACCEPT,
} from "@/components/shared/FilePicker";
import { yamlErrorOutcome } from "@/components/shared/FilePicker/outcomes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { hydrateComponentReference } from "@/services/componentService";
import { componentSpecFromYaml } from "@/utils/yaml";

enum TabType {
  URL = "URL",
  File = "File",
  New = "New",
}

const ImportComponent = ({
  triggerComponent,
}: {
  triggerComponent?: ReactNode;
}) => {
  const notify = useToastNotification();
  const { track } = useAnalytics();
  const { addToComponentLibrary } = useComponentLibrary();

  const [url, setUrl] = useState("");
  const [tab, setTab] = useState<TabType>(TabType.File);
  const [isOpen, setIsOpen] = useState(false);

  const [componentEditorTemplateSelected, setComponentEditorTemplateSelected] =
    useState<SupportedTemplate | undefined>();

  const handleTemplateSelected = (template: SupportedTemplate) => {
    track("pipeline_editor.add_component.new.begin", {
      selected_template: template,
    });
    setComponentEditorTemplateSelected(template);
    setIsOpen(false);
  };

  const handleComponentEditorDialogClose = () => {
    setComponentEditorTemplateSelected(undefined);
    setIsOpen(false);
  };

  const handleTabChange = useCallback((value: TabType) => {
    setTab(value);
  }, []);

  const {
    mutate: importComponent,
    mutateAsync: importComponentAsync,
    isPending,
  } = useMutation({
    mutationFn: async (fileText: string | undefined) => {
      // hydrateComponentReference swallows parse errors, so parse first to surface the reason.
      if (fileText !== undefined) componentSpecFromYaml(fileText);

      const componentRef = {
        text: fileText,
        url: fileText === undefined ? url : undefined,
      };

      const hydratedComponent = await hydrateComponentReference(componentRef);

      if (!hydratedComponent) {
        throw new Error("Failed to hydrate component");
      }

      return await addToComponentLibrary(hydratedComponent, "import_dialog");
    },
    onSuccess: async (result, fileText) => {
      const isFileImport = fileText !== undefined;
      if (!isFileImport) {
        setIsOpen(false);
        setUrl("");
      }

      if (result) {
        track("pipeline_editor.add_component.import_completed", {
          method: isFileImport ? "file" : "url",
        });
        if (!isFileImport) {
          notify("Component imported successfully", "success");
        }
      }
    },
    onError: (error: Error, fileText) => {
      if (fileText === undefined) {
        notify(error.message, "error");
      }
    },
  });

  const handleImport = useCallback(() => {
    void importComponent(undefined);
  }, [importComponent]);

  const handleFile = async ({
    text,
  }: {
    text: string;
  }): Promise<PickOutcome> => {
    try {
      const result = await importComponentAsync(text);
      if (!result) {
        return {
          status: "error",
          message: "The component was not added to your library.",
        };
      }
      return {
        status: "success",
        message: `${result.name} added to your library`,
      };
    } catch (error) {
      return yamlErrorOutcome(error, "Failed to hydrate component");
    }
  };

  const handleUrlChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setUrl(event.target.value);
    },
    [],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isPending) return;

      if (!open) {
        setUrl("");
      }
      setIsOpen(open);
    },
    [isPending],
  );

  const isButtonDisabled = isPending || !url;

  const ButtonComponent = triggerComponent ? (
    triggerComponent
  ) : (
    <Button
      className="w-fit"
      variant="ghost"
      data-testid="import-component-button"
    >
      <PackagePlus className="w-4 h-4" />
    </Button>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{ButtonComponent}</DialogTrigger>
        <DialogContent data-testid="import-component-dialog">
          <DialogHeader>
            <DialogTitle>Add Component</DialogTitle>
            <DialogDescription>
              Create a new component, or import from a file or a URL.
            </DialogDescription>
            <Tabs
              value={tab}
              className="w-full"
              onValueChange={(value) => handleTabChange(value as TabType)}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value={TabType.File}>File</TabsTrigger>
                <TabsTrigger value={TabType.URL}>URL</TabsTrigger>
                <TabsTrigger value={TabType.New}>New</TabsTrigger>
              </TabsList>
              <TabsContent value={TabType.File}>
                <div className="grid w-full items-center gap-4 py-4">
                  <div className="flex flex-col gap-2">
                    <FilePicker
                      accept={YAML_FILE_ACCEPT}
                      label="Component YAML file"
                      errorTitle="Import failed"
                      successTitle="Import successful"
                      afterSuccess="replace-picker"
                      disabled={isPending}
                      onFile={handleFile}
                    />
                    <Paragraph tone="subdued" size="sm">
                      Select a YAML file containing a pipeline component
                    </Paragraph>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value={TabType.URL}>
                <div className="grid w-full items-center gap-4 py-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="url">Component URL</Label>
                    <Input
                      id="url"
                      type="url"
                      placeholder="https://raw.githubusercontent.com/.../component.yaml"
                      value={url}
                      onChange={handleUrlChange}
                      disabled={isPending}
                    />
                    <Paragraph tone="subdued" size="sm">
                      Enter the URL of a component YAML file
                    </Paragraph>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value={TabType.New}>
                <NewComponentTemplateSelector
                  onTemplateSelected={handleTemplateSelected}
                />
              </TabsContent>
            </Tabs>
          </DialogHeader>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
            {tab === TabType.URL && (
              <Button
                type="submit"
                onClick={handleImport}
                disabled={isButtonDisabled}
              >
                {isPending ? (
                  <>
                    <Spinner /> Importing...
                  </>
                ) : (
                  "Import"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {componentEditorTemplateSelected && (
        <ComponentEditorDialog
          key={componentEditorTemplateSelected}
          onClose={handleComponentEditorDialogClose}
          templateName={componentEditorTemplateSelected ?? "empty"}
        />
      )}
    </>
  );
};

export default ImportComponent;
