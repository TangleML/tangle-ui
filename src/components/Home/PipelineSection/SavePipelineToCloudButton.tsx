import { observer } from "mobx-react-lite";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { useSavePipelineToCloud } from "@/hooks/useSavePipelineToCloud";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";

export const SavePipelineToCloudButton = observer(
  function SavePipelineToCloudButton({ file }: { file: PipelineFile }) {
    const { isSupported, isRetry, isPending, save } =
      useSavePipelineToCloud(file);

    if (!isSupported) return null;

    const label = isRetry ? "Retry save to server" : "Save to server";
    return (
      <div onClick={(event) => event.stopPropagation()}>
        <TooltipButton
          tooltip={isPending ? "Saving to server..." : label}
          type="button"
          variant="ghost"
          size="icon"
          className="w-fit h-fit p-1 text-muted-foreground"
          aria-label={`${label}: ${file.displayName}`}
          aria-busy={isPending}
          data-testid="save-pipeline-to-cloud"
          disabled={isPending}
          onClick={save}
        >
          <Icon
            name={
              isPending ? "LoaderCircle" : isRetry ? "RotateCw" : "CloudUpload"
            }
            className={isPending ? "animate-spin" : undefined}
          />
        </TooltipButton>
      </div>
    );
  },
);
