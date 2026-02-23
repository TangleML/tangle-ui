import { useMutation } from "@tanstack/react-query";
import { PackagePlus, X } from "lucide-react";
import { Upload } from "lucide-react";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";

import { ComponentEditorDialog } from "@/components/shared/ComponentEditor/ComponentEditorDialog";
import { NewComponentTemplateSelector } from "@/components/shared/ComponentEditor/components/NewComponentTemplateSelector";
import type { SupportedTemplate } from "@/components/shared/ComponentEditor/types";
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
import useToastNotification from "@/hooks/useToastNotification";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import { hydrateComponentReference } from "@/services/componentService";
import { getStringFromData } from "@/utils/string";

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
  const { addToComponentLibrary } = useComponentLibrary();

  const [url, setUrl] = useState("");
  const [tab, setTab] = useState<TabType>(TabType.File);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | ArrayBuffer | null>(
    null,
  );
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [componentEditorTemplateSelected, setComponentEditorTemplateSelected] =
    useState<SupportedTemplate | undefined>();

  const handleComponentEditorDialogClose = () => {
    setComponentEditorTemplateSelected(undefined);
    setIsOpen(false);
  };

  const handleTabChange = useCallback((value: TabType) => {
    setTab(value);
  }, []);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      // Don't clear the file if the user cancels the dialog
      if (!files || files.length === 0) {
        return;
      }

      const file = files[0];
      setSelectedFileName(file.name);

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (content) {
          setSelectedFile(content);
        }
      };

      reader.readAsText(file);
    },
    [],
  );

  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null);
    setSelectedFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const { mutate: importComponent, isPending } = useMutation({
    mutationFn: async () => {
      const componentRef = {
        text:
          tab === TabType.File && selectedFile
            ? getStringFromData(selectedFile)
            : undefined,
        url: tab === TabType.URL ? url : undefined,
      };

      const hydratedComponent = await hydrateComponentReference(componentRef);

      if (!hydratedComponent) {
        throw new Error("Failed to hydrate component");
      }

      return await addToComponentLibrary(hydratedComponent);
    },
    onSuccess: async (result) => {
      setIsOpen(false);
      setUrl("");
      setSelectedFile(null);
      setSelectedFileName("");

      if (result) {
        notify("Component imported successfully", "success");
      }
    },
    onError: (error: Error) => {
      notify(error.message, "error");
    },
  });

  const handleImport = useCallback(() => {
    void importComponent();
  }, [importComponent]);

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
        setSelectedFile(null);
        setSelectedFileName("");
      }
      setIsOpen(open);
    },
    [isPending],
  );

  const isButtonDisabled =
    isPending ||
    (tab === TabType.URL && !url) ||
    (tab === TabType.File && !selectedFile);

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
                    <Label htmlFor="file">Component YAML File</Label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="file"
                          type="file"
                          accept=".yaml"
                          onChange={handleFileChange}
                          disabled={isPending}
                          ref={fileInputRef}
                          className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer ${selectedFileName ? "hidden" : ""}`}
                        />
                        {!selectedFileName && (
                          <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                            <Upload className="h-8 w-8 text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600">
                              Drop your YAML file here or click to browse
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Supports .yaml files
                            </p>
                          </div>
                        )}
                        {selectedFileName && (
                          <div className="flex flex-1 items-center border rounded-md px-3 py-2 text-sm">
                            <span className="flex-1 truncate max-w-81.25">
                              {selectedFileName}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={clearSelectedFile}
                              className="h-6 w-6 p-0 ml-1 rounded-full"
                            >
                              <X className="h-3.5 w-3.5" />
                              <span className="sr-only">Clear file</span>
                            </Button>
                          </div>
                        )}
                      </div>
                      {selectedFileName && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Change
                        </Button>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      Select a YAML file containing a pipeline component
                    </p>
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
                    <p className="text-sm text-gray-500">
                      Enter the URL of a component YAML file
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value={TabType.New}>
                <NewComponentTemplateSelector
                  onTemplateSelected={setComponentEditorTemplateSelected}
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
            {tab !== TabType.New && (
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
