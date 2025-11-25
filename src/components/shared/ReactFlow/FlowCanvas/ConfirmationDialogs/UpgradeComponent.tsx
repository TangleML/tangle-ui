import { Unlink } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { InputSpec, TaskSpec } from "@/utils/componentSpec";

import { getArgumentDetails, thisCannotBeUndone } from "./shared";

export function getUpgradeConfirmationDetails(
  taskId: string,
  taskSpec: TaskSpec | undefined,
  newComponentDigest: string,
  lostInputs: InputSpec[],
) {
  const oldTaskId = taskId;
  const oldTaskSpec = taskSpec;
  const oldTaskInputs = oldTaskSpec?.componentRef.spec?.inputs;
  const oldTaskArguments = oldTaskSpec?.arguments;
  const oldTaskDigest = oldTaskSpec?.componentRef.digest;

  const hasLostInputs = lostInputs.length > 0;
  const hasMigratedInputs =
    oldTaskInputs && lostInputs.length < oldTaskInputs.length;

  const argumentsList = (
    <div className="flex flex-col gap-0 my-1">
      {lostInputs.map((input) => {
        const argument = getArgumentDetails(oldTaskArguments, input.name);

        return (
          <div key={input.name} className="flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Unlink
                  className={cn(
                    "h-3 w-3 mr-1 text-destructive font-bold",
                    !argument.isBrokenConnection && "invisible",
                  )}
                />
              </TooltipTrigger>
              <TooltipContent className="z-9999">
                Linked node will be disconnected
              </TooltipContent>
            </Tooltip>
            <span className="font-bold">{input.name}</span>
            <span className="font-light ml-1">{`(${input.type})`}</span>
            <span>:</span>
            <span className="ml-1">{argument.value}</span>
          </div>
        );
      })}
    </div>
  );

  const title = `Update ${oldTaskId}?`;
  const description = "";
  const content = (
    <div className="text-sm">
      <div>
        <p>
          This will upgrade the Task from version{" "}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="bg-muted px-1 py-0.5 rounded font-mono text-xs">
                {oldTaskDigest?.substring(0, 8)}
              </span>
            </TooltipTrigger>
            <TooltipContent className="z-9999">{oldTaskDigest}</TooltipContent>
          </Tooltip>{" "}
          to version{" "}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="bg-muted px-1 py-0.5 rounded font-mono text-xs">
                {newComponentDigest?.substring(0, 8)}
              </span>
            </TooltipTrigger>
            <TooltipContent className="z-9999">
              {newComponentDigest}
            </TooltipContent>
          </Tooltip>
        </p>
      </div>
      <br />
      {hasLostInputs ? (
        <>
          <p>The following input arguments will be removed:</p>
          <div>{argumentsList}</div>
          {hasMigratedInputs && (
            <>
              <br />
              <p>All other inputs will be preserved.</p>
            </>
          )}
        </>
      ) : (
        <p>All inputs will be preserved.</p>
      )}
      <br />
      {thisCannotBeUndone}
    </div>
  );

  return {
    title,
    description,
    content,
  };
}
