import { Handle, Position, useConnection } from "@xyflow/react";
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useState,
} from "react";
import { useEffect, useRef } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTaskNode } from "@/providers/TaskNodeProvider";
import type { InputSpec, OutputSpec } from "@/utils/componentSpec";

type InputHandleProps = {
  input: InputSpec;
  invalid: boolean;
  value?: string;
  highlight?: boolean;
  onLabelClick?: (e: ReactMouseEvent<HTMLDivElement>) => void;
  onHandleSelectionChange?: (key: string, selected: boolean) => void;
};

export const InputHandle = ({
  input,
  invalid,
  value,
  highlight,
  onLabelClick,
  onHandleSelectionChange,
}: InputHandleProps) => {
  const { nodeId, state } = useTaskNode();

  const fromHandle = useConnection((connection) => connection.fromHandle?.id);
  const toHandle = useConnection((connection) => connection.toHandle?.id);
  const fromNode = useConnection((connection) => connection.fromNode?.id);
  const toNode = useConnection((connection) => connection.toNode?.id);

  const handleRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState(false);
  const [active, setActive] = useState(false);

  const handleId = getInputHandleId(input.name);

  const missing = invalid ? "bg-red-700!" : "bg-gray-500!";
  const hasValue = value !== undefined && value !== null;
  const hasDefault = input.default !== undefined && input.default !== "";

  const handleHandleClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      setSelected(!selected);
    },
    [selected],
  );

  const handleLabelClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      onLabelClick?.(e);
      setSelected(!selected);
    },
    [onLabelClick, selected],
  );

  useEffect(() => {
    if (
      (fromHandle === handleId && fromNode === nodeId) ||
      (toHandle === handleId && toNode === nodeId)
    ) {
      queueMicrotask(() => {
        setActive(true);
      });
    } else {
      queueMicrotask(() => {
        setActive(false);
      });
    }
  }, [fromHandle, fromNode, toHandle, toNode, handleId, nodeId]);

  useEffect(() => {
    if (onHandleSelectionChange) {
      const key = input.name;
      onHandleSelectionChange(key, selected);
    }
  }, [input, selected, onHandleSelectionChange]);

  useEffect(() => {
    if (!selected) return;

    const handleClickOutside = (e: MouseEvent) => {
      const skip = skipHandleDeselect(e);
      if (skip) return;

      if (handleRef.current && !handleRef.current.contains(e.target as Node)) {
        setSelected(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [selected]);

  return (
    <div
      className="relative w-full h-fit"
      key={input.name}
      data-testid={`input-connection-${input.name}`}
      data-highlighted={highlight}
      data-selected={selected}
      data-active={active}
    >
      <div className="absolute -translate-x-6 flex items-center h-3 w-3">
        <Handle
          ref={handleRef}
          type="target"
          id={handleId}
          position={Position.Left}
          isConnectable={true}
          className={cn(
            "border-0! h-full! w-full! transform-none!",
            missing,
            (selected || active) && "bg-blue-500!",
            highlight && "bg-green-500!",
            state.readOnly && "cursor-pointer!",
          )}
          onClick={handleHandleClick}
          data-invalid={invalid}
          data-testid={`input-handle-${input.name}`}
        />
      </div>
      <div
        className={cn(
          "flex flex-row items-center rounded-md cursor-pointer relative",
        )}
        data-testid={`input-handle-label-${input.name}`}
      >
        <div className="flex flex-row w-full gap-0.5 items-center justify-between">
          <div
            className={cn(
              "flex w-fit min-w-0",
              !value ? "max-w-full" : "max-w-3/4",
            )}
          >
            <div
              className={cn(
                "text-xs text-gray-800! rounded-md px-2 py-1 truncate",
                onLabelClick && !selected && !highlight && "hover:bg-gray-300",
                selected || active ? "bg-blue-200" : "bg-gray-200",
                highlight && "bg-green-200",
                !hasValue && hasDefault && "opacity-50 italic",
              )}
              onClick={handleLabelClick}
            >
              {input.name.replace(/_/g, " ")}
            </div>
          </div>
          {(hasValue || hasDefault) && (
            <div
              className="flex w-fit max-w-1/2 min-w-0"
              data-testid={`input-handle-value-${input.name}`}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "text-xs text-gray-800! truncate inline-block text-right pr-2",
                      !hasValue && "text-gray-400! italic",
                    )}
                  >
                    {hasValue ? value : input.default}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="text-xs">
                    {hasValue ? value : input.default}
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

type OutputHandleProps = {
  output: OutputSpec;
  value?: string;
  highlight?: boolean;
  onLabelClick?: (e: ReactMouseEvent<HTMLDivElement>) => void;
  onHandleSelectionChange?: (key: string, selected: boolean) => void;
};

export const OutputHandle = ({
  output,
  value,
  highlight,
  onLabelClick,
  onHandleSelectionChange,
}: OutputHandleProps) => {
  const { nodeId, state } = useTaskNode();

  const fromHandle = useConnection((connection) => connection.fromHandle?.id);
  const toHandle = useConnection((connection) => connection.toHandle?.id);
  const fromNode = useConnection((connection) => connection.fromNode?.id);
  const toNode = useConnection((connection) => connection.toNode?.id);

  const handleRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState(false);
  const [active, setActive] = useState(false);

  const handleId = getOutputHandleId(output.name);
  const hasValue = value !== undefined && value !== "" && value !== null;

  const handleHandleClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      setSelected(!selected);
    },
    [selected],
  );

  const handleLabelClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      onLabelClick?.(e);
      setSelected(!selected);
    },
    [onLabelClick, selected],
  );

  useEffect(() => {
    if (
      (fromHandle === handleId && fromNode === nodeId) ||
      (toHandle === handleId && toNode === nodeId)
    ) {
      queueMicrotask(() => {
        setActive(true);
      });
    } else {
      queueMicrotask(() => {
        setActive(false);
      });
    }
  }, [fromHandle, fromNode, toHandle, toNode, handleId, nodeId]);

  useEffect(() => {
    if (onHandleSelectionChange) {
      const key = output.name;
      onHandleSelectionChange(key, selected);
    }
  }, [output, selected, onHandleSelectionChange]);

  useEffect(() => {
    if (!selected) return;

    const handleClickOutside = (e: MouseEvent) => {
      const skip = skipHandleDeselect(e);
      if (skip) return;

      if (handleRef.current && !handleRef.current.contains(e.target as Node)) {
        setSelected(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [selected]);

  return (
    <div
      className="flex items-center justify-end w-full cursor-pointer"
      key={output.name}
      data-testid={`output-connection-${output.name}`}
      data-highlighted={highlight}
      data-selected={selected}
      data-active={active}
    >
      <div className="flex flex-row-reverse w-full gap-0.5 items-center justify-between">
        <div
          className={cn(
            "translate-x-3 min-w-0 inline-block",
            !value ? "max-w-full" : "max-w-3/4",
          )}
        >
          <div
            className={cn(
              "text-xs text-gray-800! rounded-md px-2 py-1 truncate",
              onLabelClick && !selected && !highlight && "hover:bg-gray-300",
              selected || active ? "bg-blue-200" : "bg-gray-200",
              highlight && "bg-green-200",
            )}
            onClick={handleLabelClick}
          >
            {output.name.replace(/_/g, " ")}
          </div>
        </div>
        {hasValue && (
          <div className="max-w-1/2 min-w-0 text-xs text-gray-800! truncate inline-block text-left pr-2">
            {value}
          </div>
        )}
      </div>
      <Handle
        ref={handleRef}
        type="source"
        id={handleId}
        position={Position.Right}
        isConnectable={true}
        onClick={handleHandleClick}
        className={cn(
          "relative! border-0! !w-[12px] !h-[12px] transform-none! translate-x-6 cursor-pointer bg-gray-500!",
          (selected || active) && "bg-blue-500!",
          highlight && "bg-green-500!",
          state.readOnly && "cursor-pointer!",
        )}
        data-testid={`output-handle-${output.name}`}
      />
    </div>
  );
};

const getOutputHandleId = (outputName: string) => {
  return `output_${outputName}`;
};

const getInputHandleId = (inputName: string) => {
  return `input_${inputName}`;
};

const skipHandleDeselect = (e: MouseEvent) => {
  let el = e.target as HTMLElement | null;
  while (el) {
    if (
      el instanceof HTMLElement &&
      (el.getAttribute("data-sidebar") === "sidebar" ||
        el.getAttribute("role") === "dialog")
    ) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
};
