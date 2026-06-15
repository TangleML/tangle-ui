import type { TourStep } from "@/components/Learn/tours/registry";
import type { TourInteraction } from "@/providers/TourProvider/tourActions";
import type { EditorStore } from "@/routes/v2/shared/store/editorStore";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import type { WindowStoreImpl } from "@/routes/v2/shared/windows/windowStore";
import { isSecretArgument } from "@/utils/componentSpec";

import {
  countForInteraction,
  countSubgraphTasks,
  elementFromEvent,
  isCountInteraction,
  trackDockStateTransition,
  watchSelector,
  watchValue,
} from "./editorTourBridge.utils";

/**
 * Everything a tour interaction handler needs to detect completion. The handler
 * sets up its listeners/observers/reactions and returns a cleanup function.
 * `complete` marks the current step done; `stopFollow` tears down the
 * window-position follower the gate set up before dispatching.
 */
export interface TourInteractionContext {
  step: TourStep;
  windows: WindowStoreImpl;
  navigation: NavigationStore;
  editor: EditorStore;
  targetWindowId: string | undefined;
  complete: () => void;
  stopFollow: () => void;
}

export type InteractionHandler = (ctx: TourInteractionContext) => () => void;

function handleDockTransition(ctx: TourInteractionContext): () => void {
  const { step, windows, targetWindowId, complete, stopFollow } = ctx;
  const isDocked = (w: { dockState: string }) => w.dockState !== "none";
  const isUndocked = (w: { dockState: string }) => w.dockState === "none";
  const matchInitial =
    step.interaction === "undock-window" ? isDocked : isUndocked;
  const matchTransition =
    step.interaction === "undock-window" ? isUndocked : isDocked;

  if (targetWindowId) {
    const target = windows.getWindowById(targetWindowId);
    if (!target || matchTransition(target)) {
      complete();
      return stopFollow;
    }
  } else {
    const hasSourceWindow = windows
      .getAllWindows()
      .some((w) => w.state !== "hidden" && matchInitial(w));
    if (!hasSourceWindow) {
      complete();
      return stopFollow;
    }
  }

  const tracker = trackDockStateTransition(
    windows,
    matchInitial,
    matchTransition,
    targetWindowId,
  );

  let pendingCheck: ReturnType<typeof setTimeout> | null = null;
  const handleMouseUp = () => {
    if (pendingCheck !== null) clearTimeout(pendingCheck);
    pendingCheck = setTimeout(() => {
      pendingCheck = null;
      if (tracker.didTransition()) complete();
    }, 0);
  };
  document.addEventListener("mouseup", handleMouseUp);

  return () => {
    stopFollow();
    tracker.dispose();
    if (pendingCheck !== null) clearTimeout(pendingCheck);
    document.removeEventListener("mouseup", handleMouseUp);
  };
}

function handleSelectTask(ctx: TourInteractionContext): () => void {
  const { step, complete, stopFollow } = ctx;
  const targetName = step.targetTaskName?.toLowerCase();
  const handleClick = (event: MouseEvent) => {
    const node = elementFromEvent(event)?.closest('[data-tour-node="task"]');
    if (!node) return;
    if (targetName) {
      const name = (node.getAttribute("data-task-name") ?? "").toLowerCase();
      if (!name.includes(targetName)) return;
    }
    complete();
  };
  document.addEventListener("click", handleClick);
  return () => {
    stopFollow();
    document.removeEventListener("click", handleClick);
  };
}

function handleExpandFolder(ctx: TourInteractionContext): () => void {
  const { step, complete, stopFollow } = ctx;
  const targetFolderName = step.targetFolderName;
  if (!targetFolderName) return stopFollow;
  const expandedSelector = `[data-folder-name="${targetFolderName}"] [aria-expanded="true"]`;
  return watchSelector(expandedSelector, complete, stopFollow, [
    "aria-expanded",
  ]);
}

function handleLibrarySearch(ctx: TourInteractionContext): () => void {
  const { step, complete, stopFollow } = ctx;
  const sel = '[data-testid="search-input"]';
  const targetTerm = step.targetSearchTerm?.toLowerCase();
  const matches = () => {
    const el = document.querySelector<HTMLInputElement>(sel);
    if (!el) return false;
    const value = el.value.trim().toLowerCase();
    if (targetTerm) return value.includes(targetTerm);
    return value.length > 0;
  };

  let advanceTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleComplete = () => {
    if (advanceTimer !== null) return;
    advanceTimer = setTimeout(() => {
      advanceTimer = null;
      complete();
    }, 600);
  };

  if (matches()) {
    scheduleComplete();
  }

  const handleInput = (event: Event) => {
    const target = elementFromEvent(event);
    if (target?.matches(sel) && matches()) scheduleComplete();
  };
  document.addEventListener("input", handleInput, true);

  return () => {
    stopFollow();
    document.removeEventListener("input", handleInput, true);
    if (advanceTimer !== null) clearTimeout(advanceTimer);
  };
}

function handleSetArgument(ctx: TourInteractionContext): () => void {
  const { step, navigation, complete, stopFollow } = ctx;
  const targetArgumentName = step.targetArgumentName;
  if (!targetArgumentName) return stopFollow;

  const targetTaskName = step.targetTaskName?.toLowerCase();
  const hasArgumentValue = () => {
    const spec = navigation.activeSpec;
    if (!spec) return false;
    return spec.tasks.some((task) => {
      if (targetTaskName && !task.name.toLowerCase().includes(targetTaskName)) {
        return false;
      }
      return task.arguments.some(
        (arg) =>
          arg.name === targetArgumentName &&
          typeof arg.value === "string" &&
          arg.value.trim() !== "",
      );
    });
  };

  return watchValue(hasArgumentValue, complete, stopFollow);
}

function handleAssignSecretArgument(ctx: TourInteractionContext): () => void {
  const { step, navigation, complete, stopFollow } = ctx;
  const targetArgumentName = step.targetArgumentName;
  const hasSecretArgument = () => {
    const spec = navigation.activeSpec;
    if (!spec) return false;
    return spec.tasks.some((task) =>
      task.arguments.some(
        (arg) =>
          (!targetArgumentName || arg.name === targetArgumentName) &&
          isSecretArgument(arg.value),
      ),
    );
  };
  return watchValue(hasSecretArgument, complete, stopFollow);
}

function handleOpenSecretDialog(ctx: TourInteractionContext): () => void {
  return watchSelector(
    '[data-testid="select-secret-dialog"]',
    ctx.complete,
    ctx.stopFollow,
  );
}

function handleOpenSettingsPanel(ctx: TourInteractionContext): () => void {
  return watchSelector(
    '[data-tour="tour-settings-dialog"]',
    ctx.complete,
    ctx.stopFollow,
  );
}

function handleOpenSubmitDialog(ctx: TourInteractionContext): () => void {
  return watchSelector(
    '[data-tour="submit-arguments-dialog"]',
    ctx.complete,
    ctx.stopFollow,
  );
}

function handleAssignSecretSubmit(ctx: TourInteractionContext): () => void {
  return watchSelector(
    '[data-tour="submit-arguments-dialog"] [data-testid="dynamic-data-argument-input"]',
    ctx.complete,
    ctx.stopFollow,
  );
}

function handleConnectEdge(ctx: TourInteractionContext): () => void {
  const { step, navigation, complete, stopFollow } = ctx;
  const target = step.targetEdge;
  // No explicit edge target: fall back to "a new binding appeared" (count).
  if (!target) return handleCount(ctx);

  const hasTargetEdge = () => {
    const spec = navigation.activeSpec;
    if (!spec) return false;
    const sourceTask = spec.tasks.find((t) => t.name === target.sourceTaskName);
    if (!sourceTask) return false;

    if (!target.targetTaskName) {
      return spec.bindings.some(
        (b) =>
          b.sourceEntityId === sourceTask.$id &&
          b.sourcePortName === target.sourcePortName,
      );
    }

    const targetTask = spec.tasks.find((t) => t.name === target.targetTaskName);
    if (!targetTask) return false;
    return spec.bindings.some(
      (b) =>
        b.sourceEntityId === sourceTask.$id &&
        b.targetEntityId === targetTask.$id &&
        b.sourcePortName === target.sourcePortName &&
        b.targetPortName === target.targetPortName,
    );
  };

  return watchValue(hasTargetEdge, complete, stopFollow);
}

function handleAddTask(ctx: TourInteractionContext): () => void {
  const { step, navigation, complete, stopFollow } = ctx;
  // No named target: fall back to the generic "task count went up".
  if (!step.targetTaskName) return handleCount(ctx);

  const targetName = step.targetTaskName.toLowerCase();
  const countMatches = () => {
    const spec = navigation.activeSpec;
    if (!spec) return 0;
    return spec.tasks.filter((t) => t.name.toLowerCase().includes(targetName))
      .length;
  };
  const baseline = countMatches();
  return watchValue(() => countMatches() > baseline, complete, stopFollow);
}

function handleNavigateIntoSubgraph(ctx: TourInteractionContext): () => void {
  const { step, navigation, complete, stopFollow } = ctx;
  const targetName = step.targetTaskName?.toLowerCase();
  const baselineDepth = navigation.navigationDepth;
  const matches = () => {
    if (navigation.navigationDepth <= baselineDepth) return false;
    if (!targetName) return true;
    const last =
      navigation.navigationPath[navigation.navigationPath.length - 1];
    return last?.displayName.toLowerCase() === targetName;
  };
  return watchValue(matches, complete, stopFollow);
}

function handleNavigateToRoot(ctx: TourInteractionContext): () => void {
  const { navigation, complete, stopFollow } = ctx;
  return watchValue(
    () => navigation.navigationDepth === 0,
    complete,
    stopFollow,
  );
}

function handleUnpackSubgraph(ctx: TourInteractionContext): () => void {
  const { navigation, complete, stopFollow } = ctx;
  const baseline = countSubgraphTasks(navigation.activeSpec);
  return watchValue(
    () => countSubgraphTasks(navigation.activeSpec) < baseline,
    complete,
    stopFollow,
  );
}

function handleCreateSubgraph(ctx: TourInteractionContext): () => void {
  const { navigation, complete, stopFollow } = ctx;
  const baseline = countSubgraphTasks(navigation.activeSpec);
  return watchValue(
    () => countSubgraphTasks(navigation.activeSpec) > baseline,
    complete,
    stopFollow,
  );
}

function handleMultiSelectTasks(ctx: TourInteractionContext): () => void {
  const { step, editor, complete, stopFollow } = ctx;
  const minCount = step.targetMinCount ?? 2;
  const taskSelectionCount = () =>
    editor.multiSelection.filter((n) => n.type === "task").length;
  return watchValue(
    () => taskSelectionCount() >= minCount,
    complete,
    stopFollow,
  );
}

function handleCount(ctx: TourInteractionContext): () => void {
  const { step, navigation, complete, stopFollow } = ctx;
  const interaction = step.interaction;
  if (!isCountInteraction(interaction)) return stopFollow;
  const baseline = countForInteraction(navigation.activeSpec, interaction);
  return watchValue(
    () => countForInteraction(navigation.activeSpec, interaction) > baseline,
    complete,
    stopFollow,
  );
}

/**
 * Maps each tour interaction to the handler that detects its completion. A full
 * (non-Partial) Record gives compile-time exhaustiveness: adding a member to
 * TourInteraction forces a handler entry here.
 */
export const INTERACTION_HANDLERS: Record<TourInteraction, InteractionHandler> =
  {
    "undock-window": handleDockTransition,
    "redock-window": handleDockTransition,
    "select-task": handleSelectTask,
    "library-search": handleLibrarySearch,
    "expand-folder": handleExpandFolder,
    "set-argument": handleSetArgument,
    "assign-secret-argument": handleAssignSecretArgument,
    "open-secret-dialog": handleOpenSecretDialog,
    "open-settings-panel": handleOpenSettingsPanel,
    "open-submit-dialog": handleOpenSubmitDialog,
    "assign-secret-submit": handleAssignSecretSubmit,
    "connect-edge": handleConnectEdge,
    "add-task": handleAddTask,
    "add-input": handleCount,
    "add-output": handleCount,
    "navigate-into-subgraph": handleNavigateIntoSubgraph,
    "navigate-to-root": handleNavigateToRoot,
    "unpack-subgraph": handleUnpackSubgraph,
    "create-subgraph": handleCreateSubgraph,
    "multi-select-tasks": handleMultiSelectTasks,
  };
