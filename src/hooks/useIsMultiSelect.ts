import { useStore } from "@xyflow/react";
import { useRef } from "react";

export function useIsMultiSelect() {
  const isMultiSelect = useStore(
    (s) => s.nodes.filter((n) => n.selected).length > 1,
  );
  const ref = useRef(isMultiSelect);
  ref.current = isMultiSelect;
  return { isMultiSelect, isMultiSelectRef: ref };
}
