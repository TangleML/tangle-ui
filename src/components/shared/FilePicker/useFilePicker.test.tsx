import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ChangeEvent, DragEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileCheckError, readCheckedText } from "./fileChecks";
import {
  type PickOutcome,
  useFilePicker,
  type UseFilePickerOptions,
} from "./useFilePicker";

vi.mock("./fileChecks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./fileChecks")>()),
  readCheckedText: vi.fn(),
}));

const readText = vi.mocked(readCheckedText);

const success: PickOutcome = { status: "success", message: "Loaded" };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const pickedFileNames = (onFile: { mock: { calls: unknown[][] } }) =>
  onFile.mock.calls.map(([pick]) => (pick as { file: File }).file.name);

const settleOutsideAct = () =>
  new Promise((done) => {
    setTimeout(done, 0);
  });

function DropTarget({ options }: { options: UseFilePickerOptions }) {
  const { isDragging, dropTargetProps } = useFilePicker(options);

  return (
    <div
      data-testid="drop-target"
      data-dragging={String(isDragging)}
      {...dropTargetProps}
    >
      <input aria-label="Field" />
    </div>
  );
}

function renderTarget(options: Partial<UseFilePickerOptions> = {}) {
  const onFile = vi.fn(() => success);
  render(<DropTarget options={{ onFile, ...options }} />);
  return onFile;
}

const target = () => screen.getByTestId("drop-target");
const field = () => screen.getByLabelText("Field");
const isDragging = () => target().dataset.dragging === "true";

function fileDrag(...files: File[]) {
  return { dataTransfer: { files, types: ["Files"] } };
}

const textDrag = { dataTransfer: { files: [], types: ["text/plain"] } };

function changeEvent(files: File[], value = "C:\\fakepath\\a.txt") {
  const input = { files, value };
  return {
    input,
    event: { currentTarget: input } as unknown as ChangeEvent<HTMLInputElement>,
  };
}

function fileDragEvent() {
  return {
    dataTransfer: { files: [], types: ["Files"], dropEffect: "none" },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as DragEvent;
}

function windowDrag(type: "dragover" | "drop", types: string[]) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: { types } });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  readText.mockReset();
  readText.mockResolvedValue("file text");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useFilePicker drop target", () => {
  it("hands over the first dropped file", async () => {
    const onFile = renderTarget();
    const first = new File(["a"], "a.txt");

    fireEvent.drop(field(), fileDrag(first, new File(["b"], "b.txt")));

    await waitFor(() =>
      expect(onFile).toHaveBeenCalledExactlyOnceWith({
        file: first,
        text: "file text",
        source: "drop",
        meta: undefined,
      }),
    );
    expect(pickedFileNames(onFile)).toEqual(["a.txt"]);
    expect(readText).toHaveBeenCalledExactlyOnceWith(first, expect.anything());
  });

  it("claims a file drag, so the browser doesn't open the file instead", () => {
    renderTarget();

    expect(fireEvent.dragOver(field(), fileDrag())).toBe(false);
    expect(fireEvent.drop(field(), fileDrag())).toBe(false);
  });

  it("leaves dragged text to the elements under it", () => {
    const onFile = renderTarget();

    fireEvent.dragEnter(target(), textDrag);

    expect(isDragging()).toBe(false);
    expect(fireEvent.dragOver(field(), textDrag)).toBe(true);
    expect(fireEvent.drop(field(), textDrag)).toBe(true);
    expect(onFile).not.toHaveBeenCalled();
    expect(readText).not.toHaveBeenCalled();
  });

  it("reports a file dragged over the target until it leaves", () => {
    renderTarget();

    fireEvent.dragEnter(target(), fileDrag());
    expect(isDragging()).toBe(true);

    fireEvent.dragLeave(target(), fileDrag());
    expect(isDragging()).toBe(false);
  });

  it("keeps reporting the drag while it crosses into a child", () => {
    renderTarget();

    fireEvent.dragEnter(target(), fileDrag());
    fireEvent.dragEnter(field(), fileDrag());
    fireEvent.dragLeave(target(), fileDrag());
    expect(isDragging()).toBe(true);

    fireEvent.dragLeave(field(), fileDrag());
    expect(isDragging()).toBe(false);
  });

  it("stops reporting the drag once the file lands", async () => {
    renderTarget();

    fireEvent.dragEnter(target(), fileDrag());
    fireEvent.dragEnter(field(), fileDrag());
    fireEvent.drop(field(), fileDrag(new File(["a"], "a.txt")));
    expect(isDragging()).toBe(false);

    fireEvent.dragEnter(target(), fileDrag());
    fireEvent.dragLeave(target(), fileDrag());
    expect(isDragging()).toBe(false);
    await waitFor(() => expect(readText).toHaveBeenCalledOnce());
  });

  it("ignores a dragleave that had no dragenter", () => {
    renderTarget();

    fireEvent.dragLeave(target(), fileDrag());
    expect(isDragging()).toBe(false);

    fireEvent.dragEnter(target(), fileDrag());
    expect(isDragging()).toBe(true);

    fireEvent.dragLeave(target(), fileDrag());
    expect(isDragging()).toBe(false);
  });

  it("stops reporting a drag when disabled mid-drag, and after re-enabling", () => {
    const onFile = vi.fn(() => success);
    const { rerender } = render(<DropTarget options={{ onFile }} />);

    fireEvent.dragEnter(target(), fileDrag());
    expect(isDragging()).toBe(true);

    rerender(<DropTarget options={{ onFile, disabled: true }} />);
    expect(isDragging()).toBe(false);

    fireEvent.dragLeave(target(), fileDrag());
    rerender(<DropTarget options={{ onFile }} />);
    expect(isDragging()).toBe(false);
  });

  it("sets the copy drop effect on a file dragover", () => {
    const { result } = renderHook(() => useFilePicker({ onFile: vi.fn() }));
    const event = fileDragEvent();

    result.current.dropTargetProps.onDragOver(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.dataTransfer.dropEffect).toBe("copy");
  });

  it("stops a drop from bubbling to its ancestors", async () => {
    const onParentDrop = vi.fn();
    const onFile = vi.fn(() => success);
    render(
      <div onDrop={onParentDrop}>
        <DropTarget options={{ onFile }} />
      </div>,
    );

    fireEvent.drop(field(), fileDrag(new File(["a"], "a.txt")));

    expect(onParentDrop).not.toHaveBeenCalled();
    await waitFor(() => expect(onFile).toHaveBeenCalledOnce());
  });

  it("lets a drop bubble when stopDropPropagation is off", async () => {
    const onParentDrop = vi.fn();
    const onFile = vi.fn(() => success);
    render(
      <div onDrop={onParentDrop}>
        <DropTarget options={{ onFile, stopDropPropagation: false }} />
      </div>,
    );

    fireEvent.drop(field(), fileDrag(new File(["a"], "a.txt")));

    expect(onParentDrop).toHaveBeenCalledOnce();
    await waitFor(() => expect(onFile).toHaveBeenCalledOnce());
  });
});

describe("useFilePicker browse", () => {
  it("reads the first chosen file and clears the input for a repick", async () => {
    const onFile = vi.fn(() => success);
    const { result } = renderHook(() => useFilePicker({ onFile }));
    const first = new File(["a"], "a.txt");
    const { input, event } = changeEvent([first, new File(["b"], "b.txt")]);

    await act(async () => result.current.inputProps.onChange(event));

    expect(input.value).toBe("");
    expect(readText).toHaveBeenCalledExactlyOnceWith(first, expect.anything());
    await waitFor(() =>
      expect(onFile).toHaveBeenCalledExactlyOnceWith({
        file: first,
        text: "file text",
        source: "browse",
        meta: undefined,
      }),
    );
    expect(pickedFileNames(onFile)).toEqual(["a.txt"]);
  });

  it("keeps the input value when allowRepick is off", async () => {
    const { result } = renderHook(() =>
      useFilePicker({ onFile: vi.fn(() => success), allowRepick: false }),
    );
    const { input, event } = changeEvent([new File(["a"], "a.txt")]);

    await act(async () => result.current.inputProps.onChange(event));

    expect(input.value).toBe("C:\\fakepath\\a.txt");
  });

  it("passes the accept list to the input, and leaves it off for any file", () => {
    const yaml = renderHook(() =>
      useFilePicker({ onFile: vi.fn(), accept: [".yaml", ".yml"] }),
    );
    const any = renderHook(() => useFilePicker({ onFile: vi.fn() }));

    expect(yaml.result.current.inputProps.accept).toBe(".yaml,.yml");
    expect(any.result.current.inputProps.accept).toBeUndefined();
  });
});

describe("useFilePicker disabled", () => {
  it("ignores drags, drops, picks and handleFiles", async () => {
    const onFile = renderTarget({ disabled: true, guardWindowDrop: false });

    fireEvent.dragEnter(target(), fileDrag());
    expect(isDragging()).toBe(false);
    expect(fireEvent.dragOver(field(), fileDrag())).toBe(true);
    fireEvent.drop(field(), fileDrag(new File(["a"], "a.txt")));

    const { result } = renderHook(() =>
      useFilePicker({ onFile, disabled: true }),
    );
    const { event } = changeEvent([new File(["b"], "b.txt")]);
    await act(async () => {
      result.current.inputProps.onChange(event);
      await result.current.handleFiles([new File(["c"], "c.txt")], "browse");
    });

    expect(readText).not.toHaveBeenCalled();
    expect(onFile).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: "idle" });
    expect(result.current.inputProps.disabled).toBe(true);
  });
});

describe("useFilePicker status", () => {
  it("goes from idle to reading to success", async () => {
    const read = deferred<string>();
    readText.mockReturnValueOnce(read.promise);
    const actions = [{ label: "Open", onSelect: vi.fn() }];
    const { result } = renderHook(() =>
      useFilePicker({
        onFile: () => ({ status: "success", message: "Loaded", actions }),
      }),
    );
    const file = new File(["a"], "a.txt");

    expect(result.current.status).toEqual({ kind: "idle" });

    act(() => {
      void result.current.handleFiles([file], "browse");
    });
    expect(result.current.status).toEqual({
      kind: "reading",
      fileName: "a.txt",
    });

    await act(async () => read.resolve("text"));

    expect(result.current.status).toEqual({
      kind: "success",
      message: "Loaded",
      actions,
      fileName: "a.txt",
    });
  });

  it("shows the file check message when the file is rejected", async () => {
    const file = new File(["a"], "a.txt");
    readText.mockRejectedValueOnce(
      new FileCheckError("size", file, "a.txt is larger than 5 MB."),
    );
    const onFile = vi.fn(() => success);
    const { result } = renderHook(() => useFilePicker({ onFile }));

    await act(() => result.current.handleFiles([file], "drop"));

    expect(result.current.status).toEqual({
      kind: "error",
      message: "a.txt is larger than 5 MB.",
      fileName: "a.txt",
    });
    expect(onFile).not.toHaveBeenCalled();
  });

  it("shows an error outcome from onFile", async () => {
    const { result } = renderHook(() =>
      useFilePicker({
        onFile: () => ({
          status: "error",
          message: "Not a pipeline",
          detail: "missing implementation",
        }),
      }),
    );

    await act(() =>
      result.current.handleFiles([new File(["a"], "a.yaml")], "browse"),
    );

    expect(result.current.status).toEqual({
      kind: "error",
      message: "Not a pipeline",
      detail: "missing implementation",
      fileName: "a.yaml",
    });
  });

  it("carries an error outcome's title into the status", async () => {
    const { result } = renderHook(() =>
      useFilePicker({
        onFile: () => ({
          status: "error",
          title: "Import cancelled",
          message: "Nothing was imported",
        }),
      }),
    );

    await act(() =>
      result.current.handleFiles([new File(["a"], "a.yaml")], "browse"),
    );

    expect(result.current.status).toEqual({
      kind: "error",
      title: "Import cancelled",
      message: "Nothing was imported",
      fileName: "a.yaml",
    });
  });

  it("drops a read that a newer pick has overtaken", async () => {
    const firstRead = deferred<string>();
    const secondRead = deferred<string>();
    readText
      .mockReturnValueOnce(firstRead.promise)
      .mockReturnValueOnce(secondRead.promise);
    const onFile = vi.fn(() => success);
    const { result } = renderHook(() => useFilePicker({ onFile }));
    const first = new File(["a"], "a.txt");
    const second = new File(["b"], "b.txt");

    act(() => {
      void result.current.handleFiles([first], "browse");
    });
    act(() => {
      void result.current.handleFiles([second], "drop");
    });
    await act(async () => firstRead.resolve("stale"));

    expect(onFile).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({
      kind: "reading",
      fileName: "b.txt",
    });

    await act(async () => secondRead.resolve("fresh"));

    expect(onFile).toHaveBeenCalledExactlyOnceWith({
      file: second,
      text: "fresh",
      source: "drop",
      meta: undefined,
    });
    expect(result.current.status).toEqual({
      kind: "success",
      message: "Loaded",
      fileName: "b.txt",
    });
  });

  it("stays reading until an async onFile resolves", async () => {
    const outcome = deferred<PickOutcome>();
    const { result } = renderHook(() =>
      useFilePicker({ onFile: () => outcome.promise }),
    );

    await act(async () => {
      void result.current.handleFiles([new File(["a"], "a.txt")], "browse");
    });
    expect(result.current.status).toEqual({
      kind: "reading",
      fileName: "a.txt",
    });

    await act(async () => outcome.resolve(success));

    expect(result.current.status).toEqual({
      kind: "success",
      message: "Loaded",
      fileName: "a.txt",
    });
  });

  it("stays reading until an async onFile rejects, then reports the file", async () => {
    const outcome = deferred<PickOutcome>();
    const { result } = renderHook(() =>
      useFilePicker({ onFile: () => outcome.promise }),
    );

    await act(async () => {
      void result.current.handleFiles([new File(["a"], "a.txt")], "browse");
    });
    expect(result.current.status).toEqual({
      kind: "reading",
      fileName: "a.txt",
    });

    await act(async () => outcome.reject(new Error("boom")));

    expect(result.current.status).toEqual({
      kind: "error",
      message: "Couldn't read a.txt.",
      fileName: "a.txt",
    });
  });

  it("drops an onFile result that a newer pick has overtaken", async () => {
    const firstOutcome = deferred<PickOutcome>();
    const secondOutcome = deferred<PickOutcome>();
    const onFile = vi
      .fn<UseFilePickerOptions["onFile"]>()
      .mockReturnValueOnce(firstOutcome.promise)
      .mockReturnValueOnce(secondOutcome.promise);
    const { result } = renderHook(() => useFilePicker({ onFile }));

    await act(async () => {
      void result.current.handleFiles([new File(["a"], "a.txt")], "browse");
    });
    await act(async () => {
      void result.current.handleFiles([new File(["b"], "b.txt")], "drop");
    });
    expect(onFile).toHaveBeenCalledTimes(2);

    await act(async () => firstOutcome.resolve(success));

    expect(result.current.status).toEqual({
      kind: "reading",
      fileName: "b.txt",
    });

    await act(async () =>
      secondOutcome.resolve({ status: "error", message: "Not a pipeline" }),
    );

    expect(result.current.status).toEqual({
      kind: "error",
      message: "Not a pipeline",
      detail: undefined,
      fileName: "b.txt",
    });
    expect(onFile).toHaveBeenCalledTimes(2);
  });

  it("sets no status after a reset while onFile is pending", async () => {
    const consoleError = vi.spyOn(console, "error");
    const outcome = deferred<PickOutcome>();
    const { result } = renderHook(() =>
      useFilePicker({ onFile: () => outcome.promise }),
    );

    await act(async () => {
      void result.current.handleFiles([new File(["a"], "a.txt")], "browse");
    });
    act(() => result.current.reset());

    outcome.resolve(success);
    await settleOutsideAct();

    expect(result.current.status).toEqual({ kind: "idle" });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("sets no status after unmounting during a read", async () => {
    const consoleError = vi.spyOn(console, "error");
    const read = deferred<string>();
    readText.mockReturnValueOnce(read.promise);
    const { result, unmount } = renderHook(() =>
      useFilePicker({ onFile: () => success }),
    );

    act(() => {
      void result.current.handleFiles([new File(["a"], "a.txt")], "browse");
    });
    unmount();

    read.resolve("text");
    await settleOutsideAct();

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("keeps a status dismissed during a read dismissed when the read lands", async () => {
    const read = deferred<string>();
    readText.mockReturnValueOnce(read.promise);
    const { result } = renderHook(() =>
      useFilePicker({ onFile: () => success }),
    );

    act(() => {
      void result.current.handleFiles([new File(["a"], "a.txt")], "browse");
    });
    act(() => result.current.dismissStatus());
    expect(result.current.status).toEqual({ kind: "idle" });

    await act(async () => read.resolve("text"));

    expect(result.current.status).toEqual({ kind: "idle" });
  });

  it("does nothing when handleFiles gets no file", async () => {
    const onFile = vi.fn(() => success);
    const { result } = renderHook(() => useFilePicker({ onFile }));
    await act(() =>
      result.current.handleFiles([new File(["a"], "a.txt")], "browse"),
    );

    await act(() => result.current.handleFiles([], "browse"));

    expect(readText).toHaveBeenCalledOnce();
    expect(onFile).toHaveBeenCalledOnce();
    expect(result.current.status).toEqual({
      kind: "success",
      message: "Loaded",
      fileName: "a.txt",
    });
  });

  it("reports a file it couldn't read when onFile throws", async () => {
    const { result } = renderHook(() =>
      useFilePicker({
        onFile: () => {
          throw new Error("boom");
        },
      }),
    );

    await act(() =>
      result.current.handleFiles([new File(["a"], "a.txt")], "browse"),
    );

    expect(result.current.status).toEqual({
      kind: "error",
      message: "Couldn't read a.txt.",
      fileName: "a.txt",
    });
  });

  it("passes meta through to onFile", async () => {
    const onFile = vi.fn(() => success);
    const { result } = renderHook(() =>
      useFilePicker<{ position: number }>({ onFile }),
    );
    const file = new File(["a"], "a.txt");

    await act(() =>
      result.current.handleFiles([file, new File(["b"], "b.txt")], "drop", {
        position: 3,
      }),
    );

    expect(onFile).toHaveBeenCalledExactlyOnceWith({
      file,
      text: "file text",
      source: "drop",
      meta: { position: 3 },
    });
    expect(pickedFileNames(onFile)).toEqual(["a.txt"]);
  });

  it("returns to idle on dismissStatus", async () => {
    const { result } = renderHook(() =>
      useFilePicker({ onFile: () => success }),
    );
    await act(() =>
      result.current.handleFiles([new File(["a"], "a.txt")], "browse"),
    );
    expect(result.current.status.kind).toBe("success");

    act(() => result.current.dismissStatus());

    expect(result.current.status).toEqual({ kind: "idle" });
  });

  it("returns to idle, stops dragging and clears the input on reset", async () => {
    const { result } = renderHook(() =>
      useFilePicker({ onFile: () => success }),
    );
    await act(() =>
      result.current.handleFiles([new File(["a"], "a.txt")], "browse"),
    );
    act(() => result.current.dropTargetProps.onDragEnter(fileDragEvent()));
    expect(result.current.isDragging).toBe(true);
    const input = { value: "C:\\fakepath\\a.txt" } as HTMLInputElement;
    result.current.inputProps.ref.current = input;

    act(() => result.current.reset());

    expect(result.current.status).toEqual({ kind: "idle" });
    expect(result.current.isDragging).toBe(false);
    expect(input.value).toBe("");
  });
});

describe("useFilePicker window guard", () => {
  const listenerCalls = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.filter(([type]) => type === "dragover" || type === "drop");

  it("adds one window listener pair for all mounted pickers and removes it after the last", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");

    const first = renderHook(() => useFilePicker({ onFile: vi.fn() }));
    const second = renderHook(() => useFilePicker({ onFile: vi.fn() }));

    expect(listenerCalls(add).map(([type]) => type)).toEqual([
      "dragover",
      "drop",
    ]);

    first.unmount();
    expect(listenerCalls(remove)).toEqual([]);

    second.unmount();
    expect(listenerCalls(remove).map(([type]) => type)).toEqual([
      "dragover",
      "drop",
    ]);
  });

  it("adds no window listener when guardWindowDrop is off", () => {
    const add = vi.spyOn(window, "addEventListener");

    renderHook(() =>
      useFilePicker({ onFile: vi.fn(), guardWindowDrop: false }),
    );

    expect(listenerCalls(add)).toEqual([]);
  });

  it("keeps the window guard on while disabled", () => {
    const add = vi.spyOn(window, "addEventListener");

    renderHook(() => useFilePicker({ onFile: vi.fn(), disabled: true }));

    expect(listenerCalls(add).map(([type]) => type)).toEqual([
      "dragover",
      "drop",
    ]);
    expect(windowDrag("dragover", ["Files"]).defaultPrevented).toBe(true);
  });

  it("only cancels window drags that carry files", () => {
    const { unmount } = renderHook(() => useFilePicker({ onFile: vi.fn() }));

    expect(windowDrag("dragover", ["Files"]).defaultPrevented).toBe(true);
    expect(windowDrag("drop", ["Files"]).defaultPrevented).toBe(true);
    expect(windowDrag("dragover", ["text/plain"]).defaultPrevented).toBe(false);
    expect(windowDrag("drop", ["text/plain"]).defaultPrevented).toBe(false);

    unmount();

    expect(windowDrag("dragover", ["Files"]).defaultPrevented).toBe(false);
  });
});
