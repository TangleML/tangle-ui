import type { UndoEvent } from "mobx-keystone";

export function getUndoEventName(event: UndoEvent): string {
  if (event.type === "group") return event.groupName ?? "Group action";
  return event.actionName ?? "Action";
}
