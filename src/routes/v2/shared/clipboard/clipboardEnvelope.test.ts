import { afterEach, describe, expect, it, vi } from "vitest";

import type { NodeSnapshot } from "@/routes/v2/shared/nodes/types";

import {
  type ClipboardEnvelope,
  readPasteEventClipboardInfo,
  readSystemClipboardInfo,
  writeToSystemClipboard,
} from "./clipboardEnvelope";

const snapshot: NodeSnapshot = {
  $type: "task",
  entityId: "task_1",
  name: "train_model",
  position: { x: 10, y: 20 },
  data: {},
};

const envelope: ClipboardEnvelope = {
  _type: "tangle-pipeline-nodes",
  snapshots: [snapshot],
  bindings: [],
};

function pasteEvent(clipboardData: DataTransfer | null): ClipboardEvent {
  return { clipboardData } as ClipboardEvent;
}

function textTransfer(text: string): DataTransfer {
  return { getData: () => text } as unknown as DataTransfer;
}

function stubClipboard(clipboard: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    value: clipboard,
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readPasteEventClipboardInfo", () => {
  it("returns the envelope written by another tab", () => {
    const result = readPasteEventClipboardInfo(
      pasteEvent(textTransfer(JSON.stringify(envelope))),
    );

    expect(result).toEqual({ kind: "envelope", envelope });
  });

  it("reports plain text for unrelated content", () => {
    expect(
      readPasteEventClipboardInfo(pasteEvent(textTransfer("hello"))),
    ).toEqual({ kind: "text", text: "hello" });
  });

  it("reports plain text for JSON that is not an envelope", () => {
    expect(
      readPasteEventClipboardInfo(pasteEvent(textTransfer('{"a":1}'))),
    ).toEqual({ kind: "text", text: '{"a":1}' });
  });

  it("rejects an envelope whose snapshots field is not an array", () => {
    const malformed = JSON.stringify({
      _type: "tangle-pipeline-nodes",
      snapshots: "not-an-array",
      bindings: [],
    });

    expect(
      readPasteEventClipboardInfo(pasteEvent(textTransfer(malformed))),
    ).toEqual({ kind: "text", text: malformed });
  });

  it("rejects an envelope with no snapshots field at all", () => {
    const malformed = JSON.stringify({ _type: "tangle-pipeline-nodes" });

    expect(
      readPasteEventClipboardInfo(pasteEvent(textTransfer(malformed))),
    ).toEqual({ kind: "text", text: malformed });
  });

  it("reports empty for an empty clipboard", () => {
    expect(readPasteEventClipboardInfo(pasteEvent(textTransfer("")))).toEqual({
      kind: "empty",
    });
  });

  it("reports unavailable when the event carries no clipboardData", () => {
    expect(readPasteEventClipboardInfo(pasteEvent(null))).toEqual({
      kind: "unavailable",
    });
  });
});

describe("readSystemClipboardInfo", () => {
  it("returns the envelope when the async read succeeds", async () => {
    stubClipboard({
      readText: () => Promise.resolve(JSON.stringify(envelope)),
    });

    await expect(readSystemClipboardInfo()).resolves.toEqual({
      kind: "envelope",
      envelope,
    });
  });

  it("reports unavailable when the read is denied", async () => {
    stubClipboard({
      readText: () => Promise.reject(new Error("NotAllowedError")),
    });

    await expect(readSystemClipboardInfo()).resolves.toEqual({
      kind: "unavailable",
    });
  });

  it("reports unavailable when there is no clipboard API", async () => {
    stubClipboard(undefined);

    await expect(readSystemClipboardInfo()).resolves.toEqual({
      kind: "unavailable",
    });
  });
});

describe("writeToSystemClipboard", () => {
  it("writes a round-trippable envelope", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });

    await writeToSystemClipboard([snapshot], []);

    expect(
      readPasteEventClipboardInfo(
        pasteEvent(textTransfer(writeText.mock.calls[0][0])),
      ),
    ).toEqual({ kind: "envelope", envelope });
  });

  it("rejects when the clipboard is unwritable", async () => {
    stubClipboard({
      writeText: () => Promise.reject(new Error("NotAllowedError")),
    });

    await expect(writeToSystemClipboard([snapshot], [])).rejects.toThrow();
  });

  it("rejects when there is no clipboard API", async () => {
    stubClipboard(undefined);

    await expect(writeToSystemClipboard([snapshot], [])).rejects.toThrow();
  });
});
