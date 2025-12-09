import { getStringFromData } from "./string";

export async function readTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.name.endsWith(".yaml")) {
      reject("Only YAML files are supported");
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result;
      if (!content) {
        reject("Failed to read file");
      } else {
        resolve(getStringFromData(content));
      }
    };

    reader.readAsText(file);
  });
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
