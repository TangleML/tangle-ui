import {
  type ChangeEventHandler,
  type DragEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  type Accept,
  DEFAULT_MAX_FILE_BYTES,
  FileCheckError,
  type FileCheckMessages,
  readCheckedText,
} from "./fileChecks";

type PickSource = "browse" | "drop";

type PickAction = { label: string; onSelect: () => void };

export type PickOutcome =
  | { status: "success"; message: ReactNode; actions?: PickAction[] }
  | { status: "error"; title?: string; message: ReactNode; detail?: string };

export type PickerStatus =
  | { kind: "idle" }
  | { kind: "reading"; fileName: string }
  | {
      kind: "error";
      title?: string;
      message: ReactNode;
      detail?: string;
      fileName: string;
    }
  | {
      kind: "success";
      title?: string;
      message: ReactNode;
      actions?: PickAction[];
      fileName: string;
    };

export interface UseFilePickerOptions<M = unknown> {
  onFile: (p: {
    file: File;
    text: string;
    source: PickSource;
    meta?: M;
  }) => PickOutcome | Promise<PickOutcome>;
  accept?: Accept;
  maxBytes?: number | null;
  requireText?: boolean;
  messages?: FileCheckMessages;
  disabled?: boolean;
  allowRepick?: boolean;
  guardWindowDrop?: boolean;
  stopDropPropagation?: boolean;
}

export interface FilePickerHandle<M = unknown> {
  inputProps: {
    ref: RefObject<HTMLInputElement | null>;
    type: "file";
    accept?: string;
    tabIndex: -1;
    onChange: ChangeEventHandler<HTMLInputElement>;
    disabled?: boolean;
  };
  openBrowse: () => void;
  dropTargetProps: {
    onDragEnter: (event: DragEvent) => void;
    onDragOver: (event: DragEvent) => void;
    onDragLeave: (event: DragEvent) => void;
    onDrop: (event: DragEvent) => void;
  };
  isDragging: boolean;
  status: PickerStatus;
  handleFiles: (
    files: FileList | File[],
    source: PickSource,
    meta?: M,
  ) => Promise<void>;
  reset: () => void;
  dismissStatus: () => void;
}

const IDLE: PickerStatus = { kind: "idle" };

function carriesFiles(dataTransfer: DataTransfer | null) {
  return Array.from(dataTransfer?.types ?? []).includes("Files");
}

function preventFileDropOnWindow(event: globalThis.DragEvent) {
  if (carriesFiles(event.dataTransfer)) event.preventDefault();
}

let windowGuardCount = 0;

function acquireWindowGuard() {
  windowGuardCount += 1;
  if (windowGuardCount === 1) {
    window.addEventListener("dragover", preventFileDropOnWindow);
    window.addEventListener("drop", preventFileDropOnWindow);
  }
}

function releaseWindowGuard() {
  windowGuardCount = Math.max(0, windowGuardCount - 1);
  if (windowGuardCount === 0) {
    window.removeEventListener("dragover", preventFileDropOnWindow);
    window.removeEventListener("drop", preventFileDropOnWindow);
  }
}

export function useFilePicker<M = unknown>({
  onFile,
  accept = "any",
  maxBytes = DEFAULT_MAX_FILE_BYTES,
  requireText = true,
  messages,
  disabled = false,
  allowRepick = true,
  guardWindowDrop = true,
  stopDropPropagation = true,
}: UseFilePickerOptions<M>): FilePickerHandle<M> {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<PickerStatus>(IDLE);
  // dragenter and dragleave fire again on every child the pointer crosses, so a
  // single dragleave does not mean the drag has left the target.
  const dragDepth = useRef(0);
  const latestReadId = useRef(0);

  useEffect(() => {
    if (!guardWindowDrop) return;
    acquireWindowGuard();
    return releaseWindowGuard;
  }, [guardWindowDrop]);

  const handleFiles = async (
    files: FileList | File[],
    source: PickSource,
    meta?: M,
  ) => {
    if (disabled) return;
    const [file] = Array.from(files);
    if (!file) return;

    const readId = ++latestReadId.current;
    const isStale = () => readId !== latestReadId.current;
    setStatus({ kind: "reading", fileName: file.name });

    let text: string;
    try {
      text = await readCheckedText(file, {
        accept,
        maxBytes,
        requireText,
        messages,
      });
    } catch (error) {
      if (isStale()) return;
      setStatus({
        kind: "error",
        message:
          error instanceof FileCheckError
            ? error.message
            : `Couldn't read ${file.name}.`,
        fileName: file.name,
      });
      return;
    }
    if (isStale()) return;

    let outcome: PickOutcome;
    try {
      outcome = await onFile({ file, text, source, meta });
    } catch {
      if (isStale()) return;
      setStatus({
        kind: "error",
        message: `Couldn't read ${file.name}.`,
        fileName: file.name,
      });
      return;
    }
    if (isStale()) return;

    setStatus(
      outcome.status === "success"
        ? {
            kind: "success",
            message: outcome.message,
            actions: outcome.actions,
            fileName: file.name,
          }
        : {
            kind: "error",
            title: outcome.title,
            message: outcome.message,
            detail: outcome.detail,
            fileName: file.name,
          },
    );
  };

  const onChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    if (allowRepick) input.value = "";
    if (disabled) return;
    void handleFiles(files, "browse");
  };

  const onDragEnter = (event: DragEvent) => {
    if (disabled || !carriesFiles(event.dataTransfer)) return;
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const onDragOver = (event: DragEvent) => {
    if (disabled || !carriesFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (event: DragEvent) => {
    // Counted while disabled too, or a drag that leaves then sticks once re-enabled.
    if (!carriesFiles(event.dataTransfer)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const onDrop = (event: DragEvent) => {
    if (disabled || !carriesFiles(event.dataTransfer)) return;
    event.preventDefault();
    if (stopDropPropagation) event.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    void handleFiles(event.dataTransfer.files, "drop");
  };

  const reset = () => {
    latestReadId.current += 1;
    dragDepth.current = 0;
    setIsDragging(false);
    setStatus(IDLE);
    if (inputRef.current) inputRef.current.value = "";
  };

  const dismissStatus = () => {
    latestReadId.current += 1;
    setStatus(IDLE);
  };

  return {
    inputProps: {
      ref: inputRef,
      type: "file",
      accept: accept === "any" ? undefined : accept.join(","),
      tabIndex: -1,
      onChange,
      disabled,
    },
    openBrowse: () => inputRef.current?.click(),
    dropTargetProps: { onDragEnter, onDragOver, onDragLeave, onDrop },
    isDragging: isDragging && !disabled,
    status,
    handleFiles,
    reset,
    dismissStatus,
  };
}
