import type { MouseEvent } from "react";

export function hasNewTabModifier(event: MouseEvent) {
  return event.ctrlKey || event.metaKey;
}

export class NotTextFileError extends Error {
  constructor(fileName: string) {
    super(`${fileName} is not a UTF-8 text file`);
    this.name = "NotTextFileError";
    Object.setPrototypeOf(this, NotTextFileError.prototype);
  }
}

function decodeText(bytes: ArrayBuffer): string | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    // Binary formats can still decode as valid UTF-8, but text never holds NUL.
    return text.includes("\0") ? null : text;
  } catch {
    return null;
  }
}

export async function readTextFromFile(file: File): Promise<string> {
  const text = decodeText(await file.arrayBuffer());
  if (text === null) throw new NotTextFileError(file.name);
  return text;
}

export async function readYamlFromFile(file: File): Promise<string> {
  if (!file.name.endsWith(".yaml")) {
    throw new Error("Only YAML files are supported");
  }
  return readTextFromFile(file);
}

export function createPromiseFromDomEvent(
  eventTarget: EventTarget,
  eventName: string,
  abortSignal?: AbortSignal,
) {
  return new Promise<Event>((resolve) => {
    const handleEvent = (event: Event) => {
      eventTarget.removeEventListener(eventName, handleEvent);

      resolve(event);
    };

    eventTarget.addEventListener(eventName, handleEvent, {
      once: true,
      signal: abortSignal,
    });
  });
}
