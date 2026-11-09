import type { IconName } from "@/components/ui/icon";

export type FilePlacement = "report" | "working";

const REPORT_EXTENSIONS = new Set([
  "html",
  "htm",
  "pdf",
  "pptx",
  "ppt",
  "key",
  "docx",
  "doc",
  "xlsx",
  "xls",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "mp4",
  "mov",
  "webm",
]);

const ICONS: Record<string, IconName> = {
  html: "Globe",
  htm: "Globe",
  pdf: "FileText",
  doc: "FileText",
  docx: "FileText",
  ppt: "Presentation",
  pptx: "Presentation",
  key: "Presentation",
  xls: "Sheet",
  xlsx: "Sheet",
  csv: "Sheet",
  png: "Image",
  jpg: "Image",
  jpeg: "Image",
  gif: "Image",
  svg: "Image",
  webp: "Image",
  mp4: "Film",
  mov: "Film",
  webm: "Film",
};

function extensionOf(path: string): string {
  const name = path.split(/[?#]/)[0].split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * Pages, slides, documents and media read as finished work someone asked
 * for; notes, plans, logs and data read as what the agent needed along the
 * way. Only a default: someone can move any file either way.
 */
export function defaultPlacement(path: string): FilePlacement {
  return REPORT_EXTENSIONS.has(extensionOf(path)) ? "report" : "working";
}

export function fileIcon(path: string): IconName {
  return ICONS[extensionOf(path)] ?? "File";
}
