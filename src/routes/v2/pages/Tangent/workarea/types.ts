import type { ReactNode } from "react";

import type { ToolBridgeApi } from "@/agent/toolBridgeApi";
import type { IconName } from "@/components/ui/icon";
import type { SharedUIStore } from "@/routes/v2/shared/store/SharedStoreContext";

export type WorkareaViewKindName = "artifact" | "pipeline" | "run";

export type IdentityKey = "id" | "name";

export type WorkareaIdentity = `${IdentityKey}/${string}`;

/**
 * A workarea target: its `type` is both the view kind and the scheme, and its
 * `identity` is sub-key prefixed (`id/<value>` or `name/<value>`). The pair is
 * two-way convertible with its `type://identity` string form.
 *
 * Only a pipeline can be addressed by `name/`; a run and an artifact are always
 * `id/`, so the union rejects `run://name/…` and `artifact://name/…` at compile
 * time as well as in `parseWorkareaTarget`.
 */
export type WorkareaTarget = ArtifactTarget | PipelineTarget | RunTarget;

export interface ArtifactTarget {
  type: "artifact";
  identity: `id/${string}`;
}

export interface PipelineTarget {
  type: "pipeline";
  identity: WorkareaIdentity;
}

export interface RunTarget {
  type: "run";
  identity: `id/${string}`;
}

export type WorkareaTargetString =
  `${WorkareaViewKindName}://${WorkareaIdentity}`;

/**
 * A resolved workarea view, ready to become a tab. The `id` is assigned by the
 * context when the tab is opened. The workarea shell never switches on the
 * target's `type` — it looks each one up in the registry — so a new kind is a
 * new registered descriptor.
 */
export interface ResolvedWorkareaView {
  title: string;
  target: WorkareaTarget;
}

export type WorkareaTab = ResolvedWorkareaView & { id: string };

/**
 * Props the workarea shell passes to every view kind's `render`. Carries the
 * active Tangent session, the per-tab store registry embeddable kinds use to
 * surface their live `SharedUIStore`, and the per-tab agent-environment wiring
 * a spawnable kind (pipeline / run) uses to host a remote sub-agent bound to
 * its live canvas. The shell fills this bag from context; kinds pass the pieces
 * they need into their view.
 */
export interface WorkareaHostProps {
  isActive: boolean;
  projectId: string;
  sessionId?: string;
  registerTabStore: (tabId: string, store: SharedUIStore) => void;
  unregisterTabStore: (tabId: string) => void;
  tabEnvironmentId: (tabId: string) => string | undefined;
  registerTabEnvironment: (tabId: string, environmentId: string) => void;
  unregisterTabEnvironment: (tabId: string) => void;
  registerTabBridge: (
    tabId: string,
    kind: "pipeline" | "run",
    bridge: ToolBridgeApi,
  ) => void;
  unregisterTabBridge: (tabId: string) => void;
}

/**
 * A self-registering workarea view kind. The shell knows only `icon`,
 * `keepMounted`, and `render` — never the concrete view's internals. `resolveTitle`
 * is owned by the kind and called during target resolution (not by the shell), so
 * each kind decides its own tab title from the target — a pipeline looks its name
 * up in the registry, a run formats `Run <id>`.
 *
 * `keepMounted: true` keeps the tab mounted while inactive (hidden via CSS) so
 * a live view survives background switches; `false` mounts it only when active.
 */
export interface WorkareaViewKind {
  type: WorkareaViewKindName;
  icon: IconName;
  keepMounted: boolean;
  resolveTitle: (target: WorkareaTarget) => string | Promise<string>;
  render: (tab: WorkareaTab, hostProps: WorkareaHostProps) => ReactNode;
}
