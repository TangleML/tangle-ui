const TEXT_ARTIFACT_EXTENSIONS = new Set([
  "tsv",
  "yaml",
  "yml",
  "toml",
  "ini",
  "cfg",
  "py",
  "sql",
  "sh",
  "ts",
  "js",
]);

export interface ArtifactFile {
  blob: Blob;
  text: string;
}

function stripQueryAndHash(url: string): string {
  return url.split(/[?#]/, 1)[0];
}

export function isTextArtifact(url: string): boolean {
  const extension = stripQueryAndHash(url).split(".").pop()?.toLowerCase();
  return extension !== undefined && TEXT_ARTIFACT_EXTENSIONS.has(extension);
}

export function artifactFilename(url: string): string {
  const basename = stripQueryAndHash(url).split("/").pop() ?? "";
  try {
    return decodeURIComponent(basename);
  } catch {
    return basename;
  }
}

export async function fetchArtifactFile(
  url: string,
  authToken?: string,
): Promise<ArtifactFile> {
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `Failed to load this file (${response.status} ${response.statusText}).`,
    );
  }
  const blob = await response.blob();
  return { blob, text: await blob.text() };
}
