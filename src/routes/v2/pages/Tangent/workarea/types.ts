import type { ReactNode } from "react";

import type { IconName } from "@/components/ui/icon";
import type { SharedUIStore } from "@/routes/v2/shared/store/SharedStoreContext";
import type { PipelineRef } from "@/services/pipelineStorage/types";

/**
 * A resolved workarea view, ready to become a tab. The `id` is assigned by the
 * context when the tab is opened. The workarea shell never switches on the
 * kind — it looks each one up in the registry — so a new kind is a new union
 * arm plus a registered descriptor.
 */
export type ResolvedWorkareaView =
  | { kind: "artifact"; title: string; url: string }
  | { kind: "pipeline"; title: string; pipelineRef: PipelineRef }
  | { kind: "run"; title: string; runId: string };

export type WorkareaTab = ResolvedWorkareaView & { id: string };

/**
 * Props the workarea shell passes to every view kind's `render`. Carries the
 * active Tangent session plus the per-tab store registry embeddable kinds use
 * to surface their live `SharedUIStore`; later PRs extend this bag rather than
 * the shell.
 */
export interface WorkareaHostProps {
  sessionId?: string;
  registerTabStore: (tabId: string, store: SharedUIStore) => void;
  unregisterTabStore: (tabId: string) => void;
}

/**
 * A self-registering workarea view kind. The shell knows only `icon`,
 * `keepMounted`, and `render` — never the concrete view's internals.
 *
 * `keepMounted: true` keeps the tab mounted while inactive (hidden via CSS) so
 * a live view survives background switches; `false` mounts it only when active.
 */
export interface WorkareaViewKind {
  kind: ResolvedWorkareaView["kind"];
  icon: IconName;
  keepMounted: boolean;
  render: (tab: WorkareaTab, hostProps: WorkareaHostProps) => ReactNode;
}
