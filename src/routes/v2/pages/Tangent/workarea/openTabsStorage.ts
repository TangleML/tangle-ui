import { reaction } from "mobx";

import { isTangentSessionUrl } from "@/routes/v2/pages/Tangent/services/sessionFiles";
import type { TangentProjectStore } from "@/routes/v2/pages/Tangent/store/TangentProjectStore";
import {
  formatWorkareaTarget,
  isWorkareaTargetString,
  parseIdentity,
  parseWorkareaTarget,
} from "@/services/projects/resourceTarget";
import { getStorage } from "@/utils/typedStorage";
import { isRecord } from "@/utils/typeGuards";

import type { OpenTabs, WorkareaTab, WorkareaTarget } from "./types";

// Tabs were once saved per project alone, under "tangent-open-tabs", where a
// second account in the same browser inherited the first one's. That is left
// unread.
const OPEN_TABS_KEY = "tangent-open-tabs-by-user";

interface TabsOwner {
  userId: string;
  projectId: string;
}

const storage = getStorage<
  typeof OPEN_TABS_KEY,
  { [OPEN_TABS_KEY]: unknown }
>();

function savedByUser(): Record<string, unknown> {
  const saved = storage.getItem(OPEN_TABS_KEY);
  return isRecord(saved) ? saved : {};
}

function savedByProject(
  all: Record<string, unknown>,
  userId: string,
): Record<string, unknown> {
  const saved = Object.hasOwn(all, userId) ? all[userId] : undefined;
  return isRecord(saved) ? saved : {};
}

// An unsaved pipeline lives in this page's memory, so a later visit has
// nothing to reopen it from.
function canReopen({ target }: WorkareaTab): boolean {
  return (
    target.type !== "pipeline" || parseIdentity(target.identity).key !== "draft"
  );
}

// What's saved can be edited, and was written by whatever an agent opened, so
// a file's tab comes back only if it's still one of this Tangent's own.
function isOwnFile(target: WorkareaTarget, tangentBaseUrl: string): boolean {
  return (
    target.type !== "artifact" ||
    isTangentSessionUrl(parseIdentity(target.identity).value, tangentBaseUrl)
  );
}

function reopenedTab(tangentBaseUrl: string) {
  return (saved: unknown): WorkareaTab[] => {
    if (!isRecord(saved)) return [];
    const { title, target } = saved;
    if (typeof title !== "string" || typeof target !== "string") return [];
    if (!isWorkareaTargetString(target)) return [];
    const parsed = parseWorkareaTarget(target);
    if (!isOwnFile(parsed, tangentBaseUrl)) return [];
    return [{ id: crypto.randomUUID(), title, target: parsed }];
  };
}

export function readOpenTabs(
  { userId, projectId }: TabsOwner,
  tangentBaseUrl: string,
): OpenTabs {
  const projects = savedByProject(savedByUser(), userId);
  const saved = Object.hasOwn(projects, projectId)
    ? projects[projectId]
    : undefined;
  if (!isRecord(saved) || !Array.isArray(saved.tabs)) {
    return { tabs: [], activeId: null };
  }
  const tabs = saved.tabs.flatMap(reopenedTab(tangentBaseUrl));
  const active =
    tabs.find((tab) => formatWorkareaTarget(tab.target) === saved.active) ??
    tabs.at(-1);
  return { tabs, activeId: active?.id ?? null };
}

function writeOpenTabs(
  { userId, projectId }: TabsOwner,
  { tabs, activeId }: OpenTabs,
) {
  const all = savedByUser();
  const projects = savedByProject(all, userId);
  const kept = tabs.filter(canReopen);
  if (kept.length === 0) {
    delete projects[projectId];
  } else {
    const active = kept.find((tab) => tab.id === activeId);
    projects[projectId] = {
      tabs: kept.map(({ title, target }) => ({
        title,
        target: formatWorkareaTarget(target),
      })),
      active: active && formatWorkareaTarget(active.target),
    };
  }
  if (Object.keys(projects).length > 0) {
    all[userId] = projects;
  } else {
    delete all[userId];
  }
  storage.setItem(OPEN_TABS_KEY, Object.keys(all).length > 0 ? all : null);
}

/**
 * Saves the store's tabs now and whenever they change. What was saved before
 * is replaced, so it has to be in the store already: anything opened before
 * it was known whose tabs these are is then saved along with it.
 */
export function rememberOpenTabs(
  store: TangentProjectStore,
  userId: string,
): () => void {
  return reaction(
    () => store.openTabs,
    (openTabs) =>
      writeOpenTabs({ userId, projectId: store.projectId }, openTabs),
    { fireImmediately: true },
  );
}
