export type PipelineFileSource = "v1" | "v2";

export interface PipelineFileChange {
  storageKey: string;
  source: PipelineFileSource;
}

const events = new EventTarget();

const EVENT_NAME = "change";

const lastWriteTimes = new Map<string, Map<PipelineFileSource, number>>();

export function emitPipelineFileChanged(detail: PipelineFileChange): void {
  let perSource = lastWriteTimes.get(detail.storageKey);
  if (!perSource) {
    perSource = new Map();
    lastWriteTimes.set(detail.storageKey, perSource);
  }
  perSource.set(detail.source, Date.now());
  events.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
}

export function subscribePipelineFileChanged(
  listener: (detail: PipelineFileChange) => void,
): () => void {
  const handler = (event: Event) => {
    listener((event as CustomEvent<PipelineFileChange>).detail);
  };
  events.addEventListener(EVENT_NAME, handler);
  return () => events.removeEventListener(EVENT_NAME, handler);
}

export function getLastForeignWriteTime(
  storageKey: string,
  ownSource: PipelineFileSource,
): number | undefined {
  const perSource = lastWriteTimes.get(storageKey);
  if (!perSource) return undefined;
  let latest: number | undefined;
  for (const [source, time] of perSource) {
    if (source === ownSource) continue;
    if (latest === undefined || time > latest) latest = time;
  }
  return latest;
}
