import { useState } from "react";

export function useSelectionSet(allIds: string[]) {
  const [selection, setSelection] = useState<Set<string>>(
    () => new Set(allIds),
  );

  const toggle = (id: string, checked: boolean) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const allChecked = allIds.length > 0 && selection.size === allIds.length;
  const someChecked = selection.size > 0 && !allChecked;

  const toggleAll = () => {
    if (allChecked) {
      setSelection(new Set());
      return;
    }
    setSelection(new Set(allIds));
  };

  const selectedIds = allIds.filter((id) => selection.has(id));

  return {
    selection,
    selectedIds,
    allChecked,
    someChecked,
    toggle,
    toggleAll,
  } as const;
}
