import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useState } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { NoticeBanners } from "@/components/shared/Notices/NoticeBanners";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Text } from "@/components/ui/typography";

import {
  type DashboardSection,
  DEFAULT_SECTIONS,
  groupDashboardSections,
  moveSection,
  readDashboardLayout,
  saveDashboardLayout,
  SECTION_TYPES,
} from "./dashboardSections";
import { DashboardWidget } from "./DashboardWidget";

export function DashboardHomeView() {
  const [saved, setSaved] = useState(readDashboardLayout);
  const [draft, setDraft] = useState<DashboardSection[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const editing = draft !== null;
  const sections = draft ?? saved;
  const active = sections.find((section) => section.id === dragging);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function save() {
    const next = sections.filter((section) => section.type !== null);
    saveDashboardLayout(next);
    setSaved(next);
    setDraft(null);
  }

  function addSection(position: "top" | "bottom") {
    const section: DashboardSection = {
      id: crypto.randomUUID(),
      type: null,
      width: 3,
    };
    setDraft(
      (current) =>
        current &&
        (position === "top" ? [section, ...current] : [...current, section]),
    );
  }

  return (
    <BlockStack gap="6" align="stretch">
      <NoticeBanners />
      <InlineStack
        align="space-between"
        blockAlign="center"
        gap="3"
        className={editing ? "sticky top-0 z-20 bg-background py-2" : undefined}
      >
        <BlockStack gap="1" className="w-auto min-w-0">
          <Heading level={1}>My Dashboard</Heading>
          {editing && (
            <Text size="sm" tone="subdued">
              Choose your sections, drag to rearrange, and set their width.
            </Text>
          )}
        </BlockStack>
        <InlineStack gap="2">
          {editing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDraft(DEFAULT_SECTIONS)}
              >
                Reset to defaults
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraft(null)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={save}>
                <Icon name="Check" size="sm" />
                Save layout
              </Button>
            </>
          ) : (
            <TooltipButton
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:bg-transparent hover:text-foreground dark:hover:bg-transparent"
              tooltip="Edit dashboard layout"
              tooltipSide="bottom"
              tooltipAlign="end"
              aria-label="Edit dashboard layout"
              onClick={() => setDraft(saved)}
            >
              <Icon name="Pencil" size="sm" />
            </TooltipButton>
          )}
        </InlineStack>
      </InlineStack>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setDragging(String(active.id))}
        onDragCancel={() => setDragging(null)}
        onDragEnd={({ active, over }) => {
          if (over)
            setDraft(
              (current) =>
                current &&
                moveSection(current, String(active.id), String(over.id)),
            );
          setDragging(null);
        }}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Drag to reorder sections, or use each section’s Move left and Move right buttons.",
          },
        }}
      >
        <div className="group/dashboard">
          <div className="flex flex-col gap-8">
            {editing && (
              <Button
                variant="ghost"
                className="h-28 basis-full rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary hover:text-foreground"
                aria-label="Add section at top"
                onClick={() => addSection("top")}
              >
                <Icon name="Plus" />
                Add section
              </Button>
            )}
            {groupDashboardSections(sections).map((row, rowIndex) => (
              <div
                key={rowIndex}
                data-dashboard-row
                className="flex flex-wrap items-start gap-x-6 gap-y-8 empty:hidden"
              >
                {row.map((section) => {
                  const index = sections.indexOf(section);
                  return (
                    <DashboardWidget
                      key={section.id}
                      section={section}
                      editing={editing}
                      first={index === 0}
                      last={index === sections.length - 1}
                      onChange={(next) =>
                        setDraft(
                          (current) =>
                            current?.map((item) =>
                              item.id === next.id ? next : item,
                            ) ?? null,
                        )
                      }
                      onRemove={() =>
                        setDraft(
                          (current) =>
                            current?.filter((item) => item.id !== section.id) ??
                            null,
                        )
                      }
                      onMove={(direction) => {
                        const target = sections[index + direction];
                        if (target)
                          setDraft(
                            moveSection(sections, section.id, target.id),
                          );
                      }}
                    />
                  );
                })}
              </div>
            ))}
            {editing && (
              <Button
                variant="ghost"
                className="h-28 basis-full rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary hover:text-foreground"
                aria-label="Add section at bottom"
                onClick={() => addSection("bottom")}
              >
                <Icon name="Plus" />
                Add section
              </Button>
            )}
          </div>
          {!editing && (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center group-has-[section]/dashboard:hidden">
              <Icon
                name="LayoutDashboard"
                className="mx-auto mb-3 text-muted-foreground"
                size="lg"
              />
              <Heading level={2}>Make room for your work</Heading>
              <Text size="sm" tone="subdued" className="mt-2 block">
                Sections appear as you use Tangle. Customize your dashboard to
                choose what goes here.
              </Text>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setDraft(saved)}
              >
                Add a section
              </Button>
            </div>
          )}
        </div>
        <DragOverlay>
          {active && (
            <div className="rounded-lg border border-primary bg-background px-5 py-4 text-sm shadow-lg">
              <Icon name="GripVertical" className="mr-2 inline" size="sm" />
              {active.type ? SECTION_TYPES[active.type].title : "New section"}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </BlockStack>
  );
}
