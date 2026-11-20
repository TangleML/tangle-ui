import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";

import {
  FilePicker,
  type PickOutcome,
  YAML_FILE_ACCEPT,
  yamlErrorOutcome,
} from "@/components/shared/FilePicker";
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
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Heading, Paragraph } from "@/components/ui/typography";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import {
  getDefaultEditorPath,
  getDefaultRemoteEditorPath,
} from "@/routes/editorRoutes";
import {
  importPipelineFromYaml,
  type ImportResult,
} from "@/services/pipelineService";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import {
  isRemotePipelineRef,
  type PipelineRef,
  type RemotePipelineRef,
} from "@/services/pipelineStorage/types";

interface ImportPipelineProps {
  triggerComponent?: ReactElement<{ onClick?: () => void }>;
  onImportComplete?: (pipeline: PipelineRef | RemotePipelineRef) => void;
}

const ImportPipeline = ({
  triggerComponent,
  onImportComplete,
}: ImportPipelineProps) => {
  const { track } = useAnalytics();
  const [isOpen, setIsOpen] = useState(false);
  const [importedPipeline, setImportedPipeline] = useState<
    PipelineRef | RemotePipelineRef | null
  >(null);
  const [yamlContent, setYamlContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const storage = usePipelineStorage();

  const navigateToPipeline = () => {
    if (!importedPipeline) return;
    goToPipeline(importedPipeline);
  };

  const goToPipeline = (pipeline: PipelineRef | RemotePipelineRef) => {
    setIsOpen(false);
    setImportedPipeline(null);
    setIsLoading(false);
    setError(null);
    setSuccessMessage(null);

    if (onImportComplete) {
      onImportComplete(pipeline);
    } else {
      navigate({
        to: isRemotePipelineRef(pipeline)
          ? getDefaultRemoteEditorPath(pipeline.pipelineId)
          : getDefaultEditorPath(pipeline.name),
      });
    }
  };

  const handleImportResult = async (result: ImportResult) => {
    if (!result.successful) {
      throw new Error(
        result.errorMessage ||
          "Failed to import pipeline. Please check that the YAML is valid.",
      );
    }

    if (result.errorMessage?.includes("was renamed")) {
      setSuccessMessage(result.errorMessage);
    } else {
      setSuccessMessage(`Pipeline "${result.name}" imported successfully.`);
    }

    if (result.remote) setImportedPipeline(result.remote);
    else {
      const file = await storage.rootFolder.assignFile(result.name);
      setImportedPipeline({ name: result.name, fileId: file.id });
    }
  };

  const importFileText = async (text: string): Promise<PickOutcome> => {
    setIsImporting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await importPipelineFromYaml(storage, text);
      if (!result.successful) {
        return yamlErrorOutcome(
          new Error(result.errorMessage),
          "Failed to import pipeline. Please check that the YAML is valid.",
        );
      }

      const pipeline: PipelineRef | RemotePipelineRef = result.remote
        ? result.remote
        : {
            name: result.name,
            fileId: (await storage.rootFolder.assignFile(result.name)).id,
          };
      track("pipeline_editor.pipeline_actions.import_pipeline_completed", {
        method: "file",
      });
      return {
        status: "success",
        message: result.errorMessage?.includes("was renamed")
          ? result.errorMessage
          : `${result.name} imported`,
        actions: [
          { label: "Go to Pipeline", onSelect: () => goToPipeline(pipeline) },
        ],
      };
    } catch (err) {
      return yamlErrorOutcome(
        err,
        "An error occurred while importing the pipeline.",
      );
    } finally {
      setIsImporting(false);
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
      const result = await importPipelineFromYaml(storage, yamlContent);
      await handleImportResult(result);
      if (result.successful) {
        track("pipeline_editor.pipeline_actions.import_pipeline_completed", {
          method: "content",
        });
      }
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
    setImportedPipeline(null);
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
              Import a pipeline from a YAML file or by pasting YAML content.
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
                <FilePicker
                  accept={YAML_FILE_ACCEPT}
                  label="Pipeline YAML file"
                  errorTitle="Import failed"
                  successTitle="Import successful"
                  afterSuccess="replace-picker"
                  disabled={isImporting}
                  onFile={({ text }) => importFileText(text)}
                />
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
            <div className="border border-green-200 bg-green-50 p-3 rounded-md mt-4 dark:border-green-500/30 dark:bg-green-500/10">
              <Heading
                level={4}
                tone="success"
                size="md"
                className="font-medium mb-1"
              >
                Import Successful
              </Heading>
              <Paragraph tone="success" size="sm">
                {successMessage}
              </Paragraph>
            </div>
          )}

          {error && (
            <div className="border border-red-200 bg-red-50 p-3 rounded-md mt-4 dark:border-red-500/30 dark:bg-red-500/10">
              <Heading
                level={4}
                tone="critical"
                size="md"
                className="font-medium mb-1"
              >
                Import Failed
              </Heading>
              <Paragraph
                tone="critical"
                size="sm"
                className="whitespace-pre-wrap"
              >
                {error}
              </Paragraph>
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
