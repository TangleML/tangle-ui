import { renderHook } from "@testing-library/react";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { expect, it, vi } from "vitest";

import { ComponentSpec } from "@/models/componentSpec";
import { useClipboardShortcuts } from "@/routes/v2/pages/Editor/components/FlowCanvas/hooks/useClipboardShortcuts";
import { pasteNodes } from "@/routes/v2/pages/Editor/store/actions";
import { readPasteEventClipboardInfo } from "@/routes/v2/shared/clipboard/clipboardEnvelope";

const { clipboard, shared, notify } = vi.hoisted(() => ({
  clipboard: {},
  shared: {
    editor: {},
    keyboard: { registerShortcut: vi.fn(() => vi.fn()) },
  },
  notify: vi.fn(),
}));

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));
vi.mock("@/routes/v2/pages/Editor/store/actions", () => ({
  copySelectedNodes: vi.fn(),
  duplicateSelectedNodes: vi.fn(),
  pasteNodes: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/routes/v2/pages/Editor/store/EditorSessionContext", () => ({
  useEditorSession: () => ({ clipboard }),
}));
vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => shared,
}));
vi.mock("@/routes/v2/shared/nodes/NodeRegistryContext", () => ({
  useNodeRegistry: () => ({}),
}));
vi.mock("@/routes/v2/shared/clipboard/clipboardEnvelope", () => ({
  readPasteEventClipboardInfo: vi.fn(() => ({ kind: "empty" })),
}));

it("only handles native paste events while the pipeline is editable", () => {
  const spec = new ComponentSpec({ $id: "root", name: "Pipeline" });
  const containerRef = { current: document.createElement("div") };
  const { rerender, unmount } = renderHook(
    ({ canEdit }) => {
      const flow = useReactFlow();
      useClipboardShortcuts(spec, containerRef, flow, canEdit);
    },
    { initialProps: { canEdit: false }, wrapper: ReactFlowProvider },
  );

  const readOnlyPaste = new Event("paste", { cancelable: true });
  window.dispatchEvent(readOnlyPaste);
  expect(pasteNodes).not.toHaveBeenCalled();
  expect(readPasteEventClipboardInfo).not.toHaveBeenCalled();
  expect(readOnlyPaste.defaultPrevented).toBe(false);

  rerender({ canEdit: true });
  const editablePaste = new Event("paste", { cancelable: true });
  window.dispatchEvent(editablePaste);
  expect(pasteNodes).toHaveBeenCalledExactlyOnceWith(
    clipboard,
    spec,
    expect.any(Object),
    { kind: "empty" },
  );
  expect(editablePaste.defaultPrevented).toBe(true);

  rerender({ canEdit: false });
  window.dispatchEvent(new Event("paste", { cancelable: true }));
  expect(pasteNodes).toHaveBeenCalledTimes(1);
  unmount();
});
