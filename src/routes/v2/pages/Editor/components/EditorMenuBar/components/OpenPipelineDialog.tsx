import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockStack } from "@/components/ui/layout";
import type { PipelineRef } from "@/routes/PipelineFolders/context/FolderNavigationContext";
import { PipelineFolders } from "@/routes/PipelineFolders/PipelineFolders";

interface OpenPipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPipelineClick: (pipeline: PipelineRef) => void;
}

export function OpenPipelineDialog({
  open,
  onOpenChange,
  onPipelineClick,
}: OpenPipelineDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      data-testid="open-pipeline-dialog"
    >
      <DialogContent className="max-w-[95vw] sm:max-w-[95vw] w-full">
        <DialogHeader>
          <DialogTitle>Open Pipeline</DialogTitle>
        </DialogHeader>
        <BlockStack gap="4" className="w-full h-[80vh] overflow-y-auto">
          <PipelineFolders onPipelineClick={onPipelineClick} />
        </BlockStack>
      </DialogContent>
    </Dialog>
  );
}
