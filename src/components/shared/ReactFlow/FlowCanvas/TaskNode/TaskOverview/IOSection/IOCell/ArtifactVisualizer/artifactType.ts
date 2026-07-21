const VISUALIZABLE_TYPES = [
  "text",
  "image",
  "jsonobject",
  "jsonarray",
  "csv",
  "tsv",
  "apacheparquet",
] as const;

type VisualizableType = (typeof VISUALIZABLE_TYPES)[number];

const TYPE_ALIASES: Record<string, VisualizableType> = {
  txt: "text",
  log: "text",
  yaml: "text",
  yml: "text",
  xml: "text",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  bmp: "image",
  svg: "image",
  json: "jsonobject",
  parquet: "apacheparquet",
  table: "apacheparquet",
};

export const normalizeRawType = (type?: string | null): string =>
  (type ?? "text").toLowerCase().replace(/\s/g, "");

export const resolveArtifactType = (raw: string): string =>
  TYPE_ALIASES[raw] ?? raw;

export const isVisualizableType = (type: string): type is VisualizableType =>
  (VISUALIZABLE_TYPES as readonly string[]).includes(type);

export const inferTypeFromUri = (uri?: string | null): string | undefined => {
  if (!uri) return undefined;
  const stripped = uri.split(/[?#]/)[0];
  const ext = stripped.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  return TYPE_ALIASES[ext] ?? (isVisualizableType(ext) ? ext : undefined);
};
