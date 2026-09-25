import type { ReactNode } from "react";

import type { IconName } from "@/components/ui/icon";

/**
 * A resolved workarea view, ready to become a tab. The `id` is assigned by the
 * context when the tab is opened. PR 2 ships only the `artifact` kind; later
 * PRs register `pipeline` and `run` kinds by widening this union — the workarea
 * shell never switches on the kind, it looks each one up in the registry.
 */
export type ResolvedWorkareaView = {
  kind: "artifact";
  title: string;
  url: string;
};

export type WorkareaTab = ResolvedWorkareaView & { id: string };

/**
 * Props the workarea shell passes to every view kind's `render`. Starts with
 * the active Tangent session; later PRs extend this bag rather than the shell.
 */
export interface WorkareaHostProps {
  sessionId?: string;
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
