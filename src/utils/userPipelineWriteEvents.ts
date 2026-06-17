const target = new EventTarget();
const EVENT_NAME = "written";

export function emitUserPipelineWritten(): void {
  target.dispatchEvent(new Event(EVENT_NAME));
}

export function subscribeUserPipelineWritten(listener: () => void): () => void {
  target.addEventListener(EVENT_NAME, listener);
  return () => target.removeEventListener(EVENT_NAME, listener);
}
