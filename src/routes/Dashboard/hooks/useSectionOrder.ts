import { type DragEvent, useEffect, useState } from "react";

import type { DashboardSectionId } from "../types";

const SECTION_ORDER_STORAGE_KEY = "dashboard/section-order";

const DEFAULT_SECTION_ORDER: DashboardSectionId[] = [
  "runs",
  "components",
  "pipelines",
];

function isDashboardSectionId(value: unknown): value is DashboardSectionId {
  return value === "runs" || value === "components" || value === "pipelines";
}

function getInitialSectionOrder(): DashboardSectionId[] {
  try {
    const raw = localStorage.getItem(SECTION_ORDER_STORAGE_KEY);
    if (!raw) return DEFAULT_SECTION_ORDER;

    const parsed: unknown = JSON.parse(raw);
    if (
      !Array.isArray(parsed) ||
      parsed.length !== DEFAULT_SECTION_ORDER.length
    ) {
      return DEFAULT_SECTION_ORDER;
    }

    const parsedIds = parsed.filter(isDashboardSectionId);
    if (parsedIds.length !== DEFAULT_SECTION_ORDER.length) {
      return DEFAULT_SECTION_ORDER;
    }

    const uniqueIds = new Set(parsedIds);
    if (uniqueIds.size !== DEFAULT_SECTION_ORDER.length) {
      return DEFAULT_SECTION_ORDER;
    }

    return parsedIds;
  } catch {
    return DEFAULT_SECTION_ORDER;
  }
}

export function useSectionOrder() {
  const [sectionOrder, setSectionOrder] = useState<DashboardSectionId[]>(
    getInitialSectionOrder,
  );
  const [sectionVisibility, setSectionVisibility] = useState<
    Record<DashboardSectionId, boolean>
  >({
    runs: true,
    components: true,
    pipelines: true,
  });
  const [draggingSectionId, setDraggingSectionId] =
    useState<DashboardSectionId | null>(null);
  const [dragOverSectionId, setDragOverSectionId] =
    useState<DashboardSectionId | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        SECTION_ORDER_STORAGE_KEY,
        JSON.stringify(sectionOrder),
      );
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  }, [sectionOrder]);

  const toggleSectionVisibility = (sectionId: DashboardSectionId) => {
    setSectionVisibility((previous) => ({
      ...previous,
      [sectionId]: !previous[sectionId],
    }));
  };

  const handleSectionDragStart = (sectionId: DashboardSectionId) => {
    setDraggingSectionId(sectionId);
    setDragOverSectionId(null);
  };

  const handleSectionDragOver = (
    event: DragEvent<HTMLDivElement>,
    sectionId: DashboardSectionId,
  ) => {
    event.preventDefault();
    if (draggingSectionId && draggingSectionId !== sectionId) {
      setDragOverSectionId(sectionId);
    }
  };

  const handleSectionDrop = (targetSectionId: DashboardSectionId) => {
    if (!draggingSectionId) return;

    setSectionOrder((previous) => {
      const sourceIndex = previous.indexOf(draggingSectionId);
      const targetIndex = previous.indexOf(targetSectionId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return previous;
      }

      const reordered = [...previous];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      return reordered;
    });

    setDraggingSectionId(null);
    setDragOverSectionId(null);
  };

  const handleSectionDragEnd = () => {
    setDraggingSectionId(null);
    setDragOverSectionId(null);
  };

  const visibleSections = sectionOrder.filter(
    (sectionId) => sectionVisibility[sectionId],
  );

  return {
    sectionOrder,
    sectionVisibility,
    draggingSectionId,
    dragOverSectionId,
    visibleSections,
    toggleSectionVisibility,
    handleSectionDragStart,
    handleSectionDragOver,
    handleSectionDrop,
    handleSectionDragEnd,
  };
}
