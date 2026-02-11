import { CloudUpload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ComponentSpec } from "@/utils/componentSpec";

import GoogleCloudSubmitter from "./GoogleCloudSubmitter";

interface GoogleCloudSubmissionDialogProps {
  componentSpec?: ComponentSpec;
}

const GoogleCloudSubmissionDialog = ({
  componentSpec,
}: GoogleCloudSubmissionDialogProps) => {
  return (
    <TooltipProvider>
      <Dialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button className="w-full justify-start" variant="ghost">
                <CloudUpload className="w-4 h-4" />
                <span className="font-normal text-xs">Google Cloud</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">Submit to Google Cloud</TooltipContent>
        </Tooltip>
        <DialogContent>
          <DialogTitle>Submit to Google Cloud</DialogTitle>
          <DialogDescription>
            Run pipeline using Google&#39;s VertexAI
          </DialogDescription>
          <GoogleCloudSubmitter componentSpec={componentSpec} />
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

export default GoogleCloudSubmissionDialog;
