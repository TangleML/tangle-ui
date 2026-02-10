import type { PipelineMetadata } from "@/utils/pipelineMetadataStore";

export interface PipelineListItem<TEntry = unknown> {
  name: string;
  entry: TEntry;
  metadata?: PipelineMetadata;
}

type PipelineGrouping = "none" | "tag" | "pinned-first";

interface PipelineGroup<TEntry = unknown> {
  title: string;
  items: PipelineListItem<TEntry>[];
}

export function getAvailablePipelineTags<TEntry>(
  items: PipelineListItem<TEntry>[],
): string[] {
  const tags = new Set<string>();

  for (const item of items) {
    for (const tag of item.metadata?.tags ?? []) {
      tags.add(tag);
    }
  }

  return [...tags].sort((a, b) => a.localeCompare(b));
}

function getPrimaryGroupTag<TEntry>(item: PipelineListItem<TEntry>): string {
  const firstTag = item.metadata?.tags[0];
  return firstTag ?? "Untagged";
}

function getPinnedItems<TEntry>(
  items: PipelineListItem<TEntry>[],
): PipelineListItem<TEntry>[] {
  return items.filter((item) => item.metadata?.pinned);
}

function getUnpinnedItems<TEntry>(
  items: PipelineListItem<TEntry>[],
): PipelineListItem<TEntry>[] {
  return items.filter((item) => !item.metadata?.pinned);
}

export function organizePipelines<TEntry>(
  items: PipelineListItem<TEntry>[],
  grouping: PipelineGrouping,
): PipelineGroup<TEntry>[] {
  if (grouping === "none") {
    return [{ title: "All pipelines", items }];
  }

  if (grouping === "pinned-first") {
    const pinned = getPinnedItems(items);
    const others = getUnpinnedItems(items);
    const groups: PipelineGroup<TEntry>[] = [];

    if (pinned.length > 0) groups.push({ title: "Pinned", items: pinned });
    if (others.length > 0) groups.push({ title: "Others", items: others });

    return groups.length > 0 ? groups : [{ title: "All pipelines", items: [] }];
  }

  const groupsMap = new Map<string, PipelineListItem<TEntry>[]>();
  for (const item of items) {
    const title = getPrimaryGroupTag(item);
    const existing = groupsMap.get(title);
    if (existing) {
      existing.push(item);
    } else {
      groupsMap.set(title, [item]);
    }
  }

  return [...groupsMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, groupedItems]) => ({ title, items: groupedItems }));
}
