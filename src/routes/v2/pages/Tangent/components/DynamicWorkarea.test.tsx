import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import { WORKAREA_ID } from "@/routes/v2/pages/Tangent/layout";
import { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import type {
  WorkareaHostProps,
  WorkareaTab,
} from "@/routes/v2/pages/Tangent/workarea/types";
import { idIdentity } from "@/services/projects/resourceTarget";

import { DynamicWorkarea } from "./DynamicWorkarea";
import { TangentRemoteEnvProvider } from "./TangentRemoteEnvProvider";

let store: TangentProjectStore;
const mounted = vi.fn();
const unmounted = vi.fn();
const disconnected = vi.fn();
const terminated = vi.fn();
const stopConnection = vi.fn();
const bridge = {} as ToolBridgeApi;

vi.mock("comlink", () => ({
  proxy: (value: unknown) => value,
  wrap: () => ({
    init: vi.fn(),
    setContext: vi.fn(),
    setAiConfig: vi.fn(),
    setTraceScope: vi.fn(),
  }),
}));
vi.mock("@/hooks/useAiProviderSettings", () => ({
  useAiProviderSettings: () => ({ config: {} }),
}));
vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));
vi.mock("@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken", () => ({
  useRemoteEnvAuthToken: () => undefined,
}));
vi.mock("@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl", () => ({
  useTangentBaseUrl: () => ({ baseUrl: "https://tangent.example.com" }),
}));
vi.mock("@/routes/v2/pages/Tangent/services/remoteEnvAgentWorker", () => ({
  createRemoteEnvAgentWorker: () => ({ terminate: terminated }),
}));
vi.mock("@/routes/v2/pages/Tangent/services/remoteEnvHost", () => ({
  createRemoteEnvHost: () => ({ disconnect: disconnected }),
  describeBrowserEnv: vi.fn(),
}));
vi.mock(
  "@/routes/v2/pages/Tangent/services/connectRemoteEnvWithRefresh",
  () => ({
    connectRemoteEnvWithRefresh: ({
      initialEnvironmentId,
      onConnected,
    }: {
      initialEnvironmentId: string;
      onConnected: (id: string) => void;
    }) => {
      onConnected(initialEnvironmentId);
      return stopConnection;
    },
  }),
);

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => store,
}));
vi.mock("@/routes/v2/pages/Tangent/workarea/registry", () => ({
  getWorkareaKind: (type: string) => ({
    icon: "FileText",
    keepMounted: type === "pipeline" || type === "run",
    render: (tab: WorkareaTab, host: WorkareaHostProps) => (
      <TestView tab={tab} host={host} />
    ),
  }),
}));

function TestView({
  tab,
  host,
}: {
  tab: WorkareaTab;
  host: WorkareaHostProps;
}) {
  useEffect(() => {
    mounted(tab.id);
    return () => {
      unmounted(tab.id);
    };
  }, [tab.id]);
  return (
    <TangentRemoteEnvProvider
      sessionId="session-1"
      bridge={bridge}
      context={{ mode: "editor" }}
      environmentId={host.tabEnvironmentId(tab.id)}
      onEnvironmentReady={(id) => host.registerTabEnvironment(tab.id, id)}
      onEnvironmentClosed={() => host.unregisterTabEnvironment(tab.id)}
      onBridgeReady={(value) =>
        host.registerTabBridge(tab.id, "pipeline", value)
      }
      onBridgeClosed={() => host.unregisterTabBridge(tab.id)}
    >
      <input
        aria-label={tab.title}
        data-testid={`view-${tab.title}`}
        data-active={host.isActive}
        defaultValue="retained canvas/document state"
      />
    </TangentRemoteEnvProvider>
  );
}

function open(type: "pipeline" | "run" | "document", title = type) {
  return store.openResolvedView({
    title,
    target: { type, identity: idIdentity(title) },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  store = new TangentProjectStore("project-1");
  store.setDefaultSessionId("session-1");
});

describe("DynamicWorkarea visibility", () => {
  it("keeps live views connected and selected but inactive while hidden", async () => {
    const pipeline = open("pipeline");
    const run = open("run");
    render(<DynamicWorkarea />);
    const runInput = screen.getByTestId("view-run");
    fireEvent.change(runInput, { target: { value: "edited canvas" } });
    expect(runInput).toHaveAttribute("data-active", "true");
    const unregister = vi.spyOn(store, "unregisterTabEnvironment");

    act(() => store.hideWorkarea());

    const pane = document.getElementById(WORKAREA_ID);
    expect(pane).not.toBeVisible();
    expect(pane).toHaveStyle({ display: "none" });
    expect(pane).toHaveAttribute("inert");
    expect(runInput).toHaveAttribute("data-active", "false");
    expect(store.activeWorkareaTabId).toBe(run.id);
    expect(store.getTabEnvironmentId(pipeline.id)).toBe(
      `session-1:${pipeline.id}`,
    );
    expect(store.getTabEnvironmentId(run.id)).toBe(`session-1:${run.id}`);
    expect(mounted).toHaveBeenCalledTimes(2);
    expect(unmounted).not.toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
    expect(disconnected).not.toHaveBeenCalled();
    expect(terminated).not.toHaveBeenCalled();
    expect(stopConnection).not.toHaveBeenCalled();

    act(() => store.showWorkarea());
    expect(pane).toBeVisible();
    expect(runInput).toHaveAttribute("data-active", "true");
    expect(runInput).toHaveValue("edited canvas");
    expect(mounted).toHaveBeenCalledTimes(2);
  });

  it.each(["pipeline", "run"] as const)(
    "mounts new hidden %s agent targets and satisfies environment readiness without stealing focus",
    async (type) => {
      store.hideWorkarea();
      render(
        <>
          <input aria-label="Chat composer" />
          <DynamicWorkarea />
        </>,
      );
      const composer = screen.getByLabelText("Chat composer");
      composer.focus();
      let tab: WorkareaTab | undefined;
      act(() => {
        tab = open(type);
      });
      if (!tab) throw new Error("Expected an opened tab");
      await expect(store.waitForTabEnvironment(tab.id)).resolves.toBe(
        `session-1:${tab.id}`,
      );
      expect(store.workareaCollapsed).toBe(true);
      expect(screen.getByTestId(`view-${type}`)).toHaveAttribute(
        "data-active",
        "false",
      );
      expect(composer).toHaveFocus();
    },
  );

  it("does not unmount the logically selected keepMounted:false document on hide", () => {
    open("document");
    render(<DynamicWorkarea />);
    const documentInput = screen.getByTestId("view-document");
    fireEvent.change(documentInput, { target: { value: "unsaved document" } });
    act(() => store.hideWorkarea());
    act(() => store.showWorkarea());
    expect(screen.getByTestId("view-document")).toBe(documentInput);
    expect(documentInput).toHaveValue("unsaved document");
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
  });
});
