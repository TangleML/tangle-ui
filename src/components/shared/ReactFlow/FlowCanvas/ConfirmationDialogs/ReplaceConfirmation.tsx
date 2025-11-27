import { type Node } from "@xyflow/react";
import { Unlink } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { InputSpec, TaskSpec } from "@/utils/componentSpec";

import { getArgumentDetails, thisCannotBeUndone } from "./shared";

export function getReplaceConfirmationDetails(
  replacedNode: Node,
  newTaskId: string,
  lostInputs: InputSpec[],
) {
  const oldTaskId = replacedNode.data.taskId as string;
  const oldTaskSpec = replacedNode.data.taskSpec as TaskSpec | undefined;
  const oldTaskInputs = oldTaskSpec?.componentRef.spec?.inputs;
  const oldTaskArguments = oldTaskSpec?.arguments;

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
            <div className="flex items-baseline flex-wrap">
              <span className="font-bold wrap-break-word">{input.name}</span>
              <span className="font-light wrap-break-word ml-1">{`(${input.type})`}</span>
              <span className="shrink-0">:</span>
              <div className="break-all text-wrap overflow-hidden ml-1">
                {argument.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const title = "Replace Node?";
  const description = "";
  const content = (
    <div className="text-sm">
      <p>{`Are you sure you want to replace "${oldTaskId}" with "${newTaskId}"?`}</p>
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
