import type { MouseEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { type Accept, DEFAULT_MAX_FILE_BYTES, formatBytes } from "./fileChecks";
import { FilePickerStatus } from "./FilePickerStatus";
import {
  type FilePickerHandle,
  useFilePicker,
  type UseFilePickerOptions,
} from "./useFilePicker";

type FilePickerAfterSuccess = "replace-picker" | "keep-picker";

interface FilePickerViewProps {
  browse?: boolean;
  dropZone?: boolean;
  dragHighlight?: boolean;
  clickZoneToBrowse?: boolean;
  disabled?: boolean;
  afterSuccess?: FilePickerAfterSuccess;
  /**
   * Governs the error box and the `keep-picker` success box. Under `replace-picker` the
   * success box is always dismissible, since its ✕ is the only way back to the picker.
   */
  statusDismissible?: boolean;
  errorTitle?: string;
  successTitle?: string;
  prompt?: ReactNode;
  dragPrompt?: ReactNode;
  browseLabel?: ReactNode;
  hint?: ReactNode;
  label: string;
  inputTestId?: string;
  className?: string;
  onBrowse?: () => void;
}

export type FilePickerProps<M = unknown> = FilePickerViewProps &
  (
    | (UseFilePickerOptions<M> & { picker?: undefined })
    | (Partial<UseFilePickerOptions<M>> & { picker: FilePickerHandle<M> })
  );

function defaultHint(accept: Accept, maxBytes: number | null) {
  const parts = [
    accept === "any" ? null : `Accepts ${accept.join(", ")}`,
    maxBytes === null ? null : `up to ${formatBytes(maxBytes)}`,
  ].filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function FilePicker<M = unknown>(props: FilePickerProps<M>) {
  if (props.picker) {
    return (
      <FilePickerView
        {...props}
        picker={props.picker}
        ownsDropTarget={false}
      />
    );
  }
  return <OwnFilePicker {...props} />;
}

function OwnFilePicker<M>(
  props: FilePickerViewProps & UseFilePickerOptions<M>,
) {
  const picker = useFilePicker<M>(props);
  return <FilePickerView {...props} picker={picker} ownsDropTarget />;
}

function FilePickerView<M>({
  picker,
  ownsDropTarget,
  accept = "any",
  maxBytes = DEFAULT_MAX_FILE_BYTES,
  browse = true,
  dropZone = true,
  dragHighlight = true,
  clickZoneToBrowse = true,
  disabled: viewDisabled = false,
  afterSuccess = "replace-picker",
  statusDismissible,
  errorTitle,
  successTitle,
  prompt = "Drop a file here, or",
  dragPrompt = "Drop to use this file",
  browseLabel = "browse",
  hint = defaultHint(accept, maxBytes),
  label,
  inputTestId = "file-picker-input",
  className,
  onBrowse,
}: FilePickerViewProps &
  Pick<UseFilePickerOptions<M>, "accept" | "maxBytes"> & {
    picker: FilePickerHandle<M>;
    ownsDropTarget: boolean;
  }) {
  const { inputProps, openBrowse, dropTargetProps, isDragging, status } =
    picker;
  const disabled = viewDisabled || inputProps.disabled === true;
  const isHighlighted = isDragging && dragHighlight;
  const succeeded = status.kind === "success";
  const hidesSurface = succeeded && afterSuccess === "replace-picker";
  const statusAboveSurface = succeeded && afterSuccess === "keep-picker";

  const startBrowse = () => {
    onBrowse?.();
    openBrowse();
  };

  const browseFromButton = (event: MouseEvent) => {
    event.stopPropagation();
    startBrowse();
  };

  const statusBox = (
    <FilePickerStatus
      status={status}
      errorTitle={errorTitle}
      successTitle={successTitle}
      dismissible={hidesSurface || statusDismissible}
      onDismiss={picker.dismissStatus}
    />
  );

  const zone = (
    <div
      {...(ownsDropTarget ? dropTargetProps : {})}
      onClick={clickZoneToBrowse && !disabled ? startBrowse : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-3 transition-colors",
        isHighlighted ? "border-primary bg-primary/5" : "border-input",
        clickZoneToBrowse && !disabled && "cursor-pointer",
        disabled && "opacity-50",
      )}
    >
      <Icon name="FileUp" size="sm" className="text-muted-foreground" />
      <div className="flex flex-col gap-0.5">
        {isHighlighted ? (
          <Text size="xs" tone="subdued">
            {dragPrompt}
          </Text>
        ) : (
          <Text size="xs" tone="subdued">
            {prompt}
            {browse && (
              <>
                {" "}
                <Button
                  type="button"
                  variant="link"
                  size="inline-xs"
                  disabled={disabled}
                  onClick={browseFromButton}
                >
                  {browseLabel}
                </Button>
              </>
            )}
          </Text>
        )}
        {hint && (
          <Text size="xs" tone="subdued">
            {hint}
          </Text>
        )}
      </div>
    </div>
  );

  const plainBrowse = browse && (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={startBrowse}
      className="self-start"
    >
      {browseLabel}
    </Button>
  );

  return (
    <div
      role="region"
      aria-label={label}
      className={cn("flex flex-col gap-2", className)}
    >
      <input
        {...inputProps}
        className="sr-only"
        data-testid={inputTestId}
        aria-label={label}
      />
      {statusAboveSurface && statusBox}
      {!hidesSurface && (dropZone ? zone : plainBrowse)}
      {!statusAboveSurface && statusBox}
    </div>
  );
}
