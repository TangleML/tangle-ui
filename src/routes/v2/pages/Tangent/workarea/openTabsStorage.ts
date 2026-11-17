import { reaction } from "mobx";

import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import {
  formatWorkareaTarget,
  isWorkareaTargetString,
  parseIdentity,
  parseWorkareaTarget,
} from "@/services/projects/resourceTarget";
import { getStorage } from "@/utils/typedStorage";
import { isRecord } from "@/utils/typeGuards";

import type { OpenTabs, WorkareaTab } from "./types";

const OPEN_TABS_KEY = "tangent-open-tabs";

const storage = getStorage<
  typeof OPEN_TABS_KEY,
  { [OPEN_TABS_KEY]: unknown }
>();

function savedByProject(): Record<string, unknown> {
  const saved = storage.getItem(OPEN_TABS_KEY);
  return isRecord(saved) ? saved : {};
}

// An unsaved pipeline lives in this page's memory, so a later visit has
// nothing to reopen it from.
function canReopen({ target }: WorkareaTab): boolean {
  return (
    target.type !== "pipeline" || parseIdentity(target.identity).key !== "draft"
  );
}

function reopenedTab(saved: unknown): WorkareaTab[] {
  if (!isRecord(saved)) return [];
  const { title, target } = saved;
  if (typeof title !== "string" || typeof target !== "string") return [];
  if (!isWorkareaTargetString(target)) return [];
  return [
    { id: crypto.randomUUID(), title, target: parseWorkareaTarget(target) },
  ];
}

export function readOpenTabs(projectId: string): OpenTabs {
  const saved = savedByProject()[projectId];
  if (!isRecord(saved) || !Array.isArray(saved.tabs)) {
    return { tabs: [], activeId: null };
  }
  const tabs = saved.tabs.flatMap(reopenedTab);
  const active =
    tabs.find((tab) => formatWorkareaTarget(tab.target) === saved.active) ??
    tabs.at(-1);
  return { tabs, activeId: active?.id ?? null };
}

function writeOpenTabs(projectId: string, { tabs, activeId }: OpenTabs) {
  const all = savedByProject();
  const kept = tabs.filter(canReopen);
  if (kept.length === 0) {
    delete all[projectId];
  } else {
    const active = kept.find((tab) => tab.id === activeId);
    all[projectId] = {
      tabs: kept.map(({ title, target }) => ({
        title,
        target: formatWorkareaTarget(target),
      })),
      active: active && formatWorkareaTarget(active.target),
    };
  }
  storage.setItem(OPEN_TABS_KEY, Object.keys(all).length > 0 ? all : null);
}

export function rememberOpenTabs(store: TangentProjectStore): () => void {
  return reaction(
    () => store.openTabs,
    (openTabs) => writeOpenTabs(store.projectId, openTabs),
  );
}
