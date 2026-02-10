import { isRecord } from "@/utils/typeGuards";

const STORAGE_KEY = "dashboard/pipeline-metadata";

export interface PipelineMetadata {
  tags: string[];
  pinned: boolean;
}

type PipelineMetadataMap = Record<string, PipelineMetadata>;

function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    const trimmed = tag.trim();
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function isPipelineMetadata(value: unknown): value is PipelineMetadata {
  return (
    isRecord(value) &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    typeof value.pinned === "boolean"
  );
}

function parsePipelineMetadataMap(raw: unknown): PipelineMetadataMap {
  if (!isRecord(raw)) return {};

  const map: PipelineMetadataMap = {};

  for (const [name, value] of Object.entries(raw)) {
    if (typeof name !== "string") continue;
    if (!isPipelineMetadata(value)) continue;

    map[name] = {
      tags: normalizeTags(value.tags),
      pinned: value.pinned,
    };
  }

  return map;
}

function savePipelineMetadataMap(map: PipelineMetadataMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function getAllPipelineMetadata(): PipelineMetadataMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    return parsePipelineMetadataMap(parsed);
  } catch {
    return {};
  }
}

export function getPipelineMetadata(
  name: string,
): PipelineMetadata | undefined {
  return getAllPipelineMetadata()[name];
}

export function setPipelineTags(
  name: string,
  tags: string[],
): PipelineMetadata {
  const map = getAllPipelineMetadata();
  const previous = map[name];
  const next: PipelineMetadata = {
    tags: normalizeTags(tags),
    pinned: previous?.pinned ?? false,
  };
  map[name] = next;
  savePipelineMetadataMap(map);
  return next;
}

export function togglePipelinePinned(name: string): PipelineMetadata {
  const map = getAllPipelineMetadata();
  const previous = map[name];
  const next: PipelineMetadata = {
    tags: previous?.tags ?? [],
    pinned: !(previous?.pinned ?? false),
  };
  map[name] = next;
  savePipelineMetadataMap(map);
  return next;
}
