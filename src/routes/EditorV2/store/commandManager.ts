/**
 * Command Manager for undo/redo functionality.
 *
 * Manages the execution, undo, and redo of commands.
 * Uses Valtio for reactive state management of undo/redo stacks.
 */

import { proxy } from "valtio";

import type { Command } from "./commands";

/** Maximum number of commands to keep in the undo stack */
const MAX_UNDO_STACK_SIZE = 100;

/**
 * Command Manager state for Valtio reactivity.
 */
interface CommandManagerState {
  /** Stack of commands that can be undone (most recent last) */
  undoStack: Command[];
  /** Stack of commands that can be redone (most recent last) */
  redoStack: Command[];
}

/**
 * The global command manager state.
 * Use `useSnapshot` in React components for reactive updates.
 */
export const commandManagerState = proxy<CommandManagerState>({
  undoStack: [],
  redoStack: [],
});

/**
 * Check if undo is available.
 */
export function canUndo(): boolean {
  return commandManagerState.undoStack.length > 0;
}

/**
 * Check if redo is available.
 */
export function canRedo(): boolean {
  return commandManagerState.redoStack.length > 0;
}

/**
 * Execute a command and add it to the undo stack.
 * Clears the redo stack since we're branching from history.
 *
 * @param command The command to execute
 * @returns true if the command executed successfully, false otherwise
 */
export function executeCommand(command: Command): boolean {
  const success = command.execute();

  if (success) {
    // Add to undo stack
    commandManagerState.undoStack.push(command);

    // Trim undo stack if it exceeds max size
    if (commandManagerState.undoStack.length > MAX_UNDO_STACK_SIZE) {
      commandManagerState.undoStack = commandManagerState.undoStack.slice(
        -MAX_UNDO_STACK_SIZE,
      );
    }

    // Clear redo stack (we're branching from history)
    commandManagerState.redoStack = [];
  }

  return success;
}

/**
 * Undo the most recent command.
 *
 * @returns true if undo was successful, false if no commands to undo or undo failed
 */
export function undo(): boolean {
  const command = commandManagerState.undoStack.pop();
  if (!command) {
    return false;
  }

  const success = command.undo();
  if (success) {
    // Move to redo stack
    commandManagerState.redoStack.push(command);
  } else {
    // If undo failed, put the command back
    commandManagerState.undoStack.push(command);
  }

  return success;
}

/**
 * Redo the most recently undone command.
 *
 * @returns true if redo was successful, false if no commands to redo or redo failed
 */
export function redo(): boolean {
  const command = commandManagerState.redoStack.pop();
  if (!command) {
    return false;
  }

  const success = command.execute();
  if (success) {
    // Move back to undo stack
    commandManagerState.undoStack.push(command);
  } else {
    // If redo failed, put the command back
    commandManagerState.redoStack.push(command);
  }

  return success;
}

/**
 * Clear all command history.
 * Useful when loading a new document or resetting state.
 */
export function clearCommandHistory(): void {
  commandManagerState.undoStack = [];
  commandManagerState.redoStack = [];
}

/**
 * Get the description of the command that would be undone.
 * Useful for UI hints like "Undo: Rename task to X".
 */
export function getUndoDescription(): string | null {
  const stack = commandManagerState.undoStack;
  if (stack.length === 0) return null;
  return stack[stack.length - 1].description;
}

/**
 * Get the description of the command that would be redone.
 * Useful for UI hints like "Redo: Rename task to X".
 */
export function getRedoDescription(): string | null {
  const stack = commandManagerState.redoStack;
  if (stack.length === 0) return null;
  return stack[stack.length - 1].description;
}

/**
 * Get the number of commands in the undo stack.
 */
export function getUndoStackSize(): number {
  return commandManagerState.undoStack.length;
}

/**
 * Get the number of commands in the redo stack.
 */
export function getRedoStackSize(): number {
  return commandManagerState.redoStack.length;
}

/**
 * Undo multiple commands to reach a specific index in the undo stack.
 * Index 0 means undo all commands (go back to initial state).
 * Index undoStack.length - 1 means no undo (stay at current state).
 *
 * @param targetIndex The target index in the undo stack (0 to undoStack.length - 1)
 * @returns true if all undos succeeded
 */
export function undoToIndex(targetIndex: number): boolean {
  const currentIndex = commandManagerState.undoStack.length - 1;

  if (targetIndex < -1 || targetIndex >= commandManagerState.undoStack.length) {
    return false;
  }

  // Number of undos needed
  const undosNeeded = currentIndex - targetIndex;

  for (let i = 0; i < undosNeeded; i++) {
    if (!undo()) {
      return false;
    }
  }

  return true;
}

/**
 * Redo multiple commands to reach a specific index in the redo stack.
 * This effectively moves forward in history.
 *
 * @param stepsForward Number of redo operations to perform
 * @returns true if all redos succeeded
 */
export function redoMultiple(stepsForward: number): boolean {
  for (let i = 0; i < stepsForward; i++) {
    if (!redo()) {
      return false;
    }
  }
  return true;
}

