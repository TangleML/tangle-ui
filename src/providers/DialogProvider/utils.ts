import { DialogCancelledError, type DialogInstance } from "./types";

/** URL search parameter keys used for dialog routing */
export const DIALOG_SEARCH_PARAMS = {
  DIALOG_KEY: "dialog",
  DIALOG_ID: "dialogId",
} as const;

/** Array of dialog-related search param keys for easy omission */
export const DIALOG_PARAM_KEYS = [
  DIALOG_SEARCH_PARAMS.DIALOG_KEY,
  DIALOG_SEARCH_PARAMS.DIALOG_ID,
] as const;

export function generateDialogId(): string {
  return crypto.randomUUID();
}

export function omitSearchParams(
  params: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const result = { ...params };
  keys.forEach((key) => delete result[key]);
  return result;
}

/** Creates a standardized cancellation error for dialog operations */
export function createCancellationError(
  message = "Dialog cancelled",
): DialogCancelledError {
  return new DialogCancelledError(message);
}

/** Gets the topmost dialog with a routeKey from the stack */
export function getTopRoutedDialog(
  stack: DialogInstance[],
): DialogInstance | null {
  const dialogsWithRouteKey = stack.filter((d) => d.routeKey);
  return dialogsWithRouteKey.length > 0
    ? dialogsWithRouteKey[dialogsWithRouteKey.length - 1]
    : null;
}

/** Gets all routed dialogs above a given index in the stack */
export function getRoutedDialogsAbove(
  stack: DialogInstance[],
  targetIndex: number,
): DialogInstance[] {
  return stack.slice(targetIndex + 1).filter((d) => d.routeKey);
}
