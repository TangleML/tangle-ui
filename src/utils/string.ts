import type { ArgumentType } from "./componentSpec";

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const formatJsonValue = (value: string | object) => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(value);
  }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
};

const getValue = (value: string | ArgumentType | undefined) => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(value);
  }
};

const removeTrailingDateFromTitle = (baseName: string) => {
  // this regex matches a timestamp in the ISO 8601 format like (YYYY-MM-DDTHH:MM:SS.sssZ) at the very end of a string
  const dateRegex = /\(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\)$/;
  const nameWithoutDate = baseName.replace(dateRegex, "");
  return nameWithoutDate.trimEnd();
};

// Lists an array of strings up to a given number of elements and then truncates to "and [number] others".
// Includes smart formatting of the list & pluralization.
function createStringList(
  list: string[],
  elementsToList: number,
  elementLabel: string,
): string {
  if (list.length === 0) return "";
  if (list.length === 1) return `"${list[0]}"`;

  const shown = list.slice(0, elementsToList);
  const remaining = list.length - shown.length;

  const quoted = shown.map((item) => `"${item}"`);
  const lastItem = quoted.pop();

  if (shown.length === 0) {
    return list.length + " " + elementLabel + (list.length > 1 ? "s" : "");
  }

  if (remaining === 0) {
    return quoted.join(", ") + " & " + lastItem;
  }

  return (
    quoted.join(", ") +
    (shown.length > 1 ? ", " : "") +
    lastItem +
    ` and ${remaining} other ${elementLabel}${remaining > 1 ? "s" : ""}`
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  } else if (typeof error === "string") {
    return error;
  } else {
    return "An unknown error occurred";
  }
}

function pluralize(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : plural || `${singular}s`;
}

function safeJsonParse(value: unknown): {
  parsed: unknown;
  isValidJson: boolean;
} {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return { parsed, isValidJson: true };
    } catch {
      return { parsed: value, isValidJson: false };
    }
  }

  return { parsed: value, isValidJson: false };
}

/**
 * Accepts string or ArrayBuffer and returns string.
 *
 * @todo: use utility in other places
 *
 * @param data - The data to normalize.
 * @returns The string representation of the data.
 */
export function getStringFromData(data: string | ArrayBuffer): string {
  if (typeof data === "object" && "byteLength" in data) {
    return new TextDecoder().decode(data);
  }

  return data;
}

export {
  copyToClipboard,
  createStringList,
  formatBytes,
  formatJsonValue,
  getErrorMessage,
  getValue,
  pluralize,
  removeTrailingDateFromTitle,
  safeJsonParse,
};
