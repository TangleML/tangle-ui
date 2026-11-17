import type { IconName } from "@/components/ui/icon";

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

export function fileIcon(path: string): IconName {
  return ICONS[extensionOf(path)] ?? "File";
}
