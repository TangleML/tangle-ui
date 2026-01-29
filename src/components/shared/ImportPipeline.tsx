import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { ChangeEvent, ReactElement } from "react";
import { useRef, useState } from "react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EDITOR_PATH } from "@/routes/router";
import {
  importPipelineFromFile,
  importPipelineFromYaml,
  type ImportResult,
} from "@/services/pipelineService";

interface ImportPipelineProps {
  triggerComponent?: ReactElement<{ onClick?: () => void }>;
}

const ImportPipeline = ({ triggerComponent }: ImportPipelineProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newPipelineName, setNewPipelineName] = useState<string | null>(null);
  const [yamlContent, setYamlContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const navigateToPipeline = () => {
    if (newPipelineName) {
      setIsOpen(false);
      setNewPipelineName(null);
      setIsLoading(false);
      setError(null);
      setSuccessMessage(null);
      navigate({ to: `${EDITOR_PATH}/${encodeURIComponent(newPipelineName)}` });
    }
  };

  const handleImportResult = (result: ImportResult) => {
    if (result.successful) {
      if (result.errorMessage?.includes("was renamed")) {
        setSuccessMessage(result.errorMessage);
      } else if (result.successful) {
        setSuccessMessage(`Pipeline "${result.name}" imported successfully.`);
      }
      setNewPipelineName(result.name);
    } else {
      throw new Error(
        result.errorMessage ||
          "Failed to import pipeline. Please check that the YAML is valid.",
      );
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await importPipelineFromFile(files[0]);
      handleImportResult(result);
    } catch (err) {
      setError(
        (err as Error).message ||
          "An error occurred while importing the pipeline.",
      );
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePasteImport = async () => {
    if (!yamlContent.trim()) {
      setError("Please enter YAML content to import.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await importPipelineFromYaml(yamlContent);
      handleImportResult(result);
    } catch (err) {
      setError(
        (err as Error).message ||
          "An error occurred while importing the pipeline.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    setError(null);
    setSuccessMessage(null);
    setYamlContent("");
  };

  const ButtonComponent = triggerComponent ? (
    triggerComponent
  ) : (
    <Button variant="secondary">Import Pipeline</Button>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{ButtonComponent}</DialogTrigger>
        <DialogContent className="sm:max-w-150">
          <DialogHeader>
            <DialogTitle>Import Pipeline</DialogTitle>
            <DialogDescription>
              Import a pipeline from a YAML file or by pasting YAML content. If
              a pipeline with the same name already exists, a unique name will
              be automatically generated.
            </DialogDescription>
          </DialogHeader>
          {isLoading && (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
          {!successMessage && !isLoading && (
            <Tabs defaultValue="file" className="w-full gap-4">
              <TabsList>
                <TabsTrigger value="file">Import from File</TabsTrigger>
                <TabsTrigger value="paste">Paste YAML</TabsTrigger>
              </TabsList>
              <TabsContent value="file">
                <div className="grid w-full items-center gap-1.5">
                  <Label
                    htmlFor="pipeline-file"
                    className="text-sm cursor-pointer"
                  >
                    Pipeline YAML File. Drag and drop a file here or click to
                    upload.
                  </Label>
                  <Input
                    ref={fileInputRef}
                    id="pipeline-file"
                    type="file"
                    accept=".yaml,.yml"
                    onChange={handleFileChange}
                    disabled={isLoading}
                    className="cursor-pointer"
                  />
                </div>
              </TabsContent>
              <TabsContent value="paste">
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="yaml-content">Pipeline YAML Content</Label>
                  <Textarea
                    id="yaml-content"
                    placeholder="Paste your YAML content here..."
                    value={yamlContent}
                    onChange={(e) => setYamlContent(e.target.value)}
                    rows={25}
                    disabled={isLoading}
                    className="font-mono text-sm resize-none max-h-75"
                  />
                  <Button
                    onClick={handlePasteImport}
                    disabled={isLoading || !yamlContent.trim()}
                  >
                    {isLoading ? "Importing..." : "Import"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {successMessage && (
            <div className="border border-green-200 bg-green-50 p-3 rounded-md mt-4">
              <h4 className="text-green-600 font-medium mb-1">
                Import Successful
              </h4>
              <p className="text-green-500 text-sm">{successMessage}</p>
            </div>
          )}

          {error && (
            <div className="border border-red-200 bg-red-50 p-3 rounded-md mt-4">
              <h4 className="text-red-600 font-medium mb-1">Import Failed</h4>
              <p className="text-red-500 text-sm whitespace-pre-wrap">
                {error}
              </p>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                {successMessage ? "Close" : "Cancel"}
              </Button>
            </DialogClose>
            {successMessage && (
              <Button
                type="button"
                variant="secondary"
                onClick={navigateToPipeline}
              >
                Go to Pipeline
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImportPipeline;
