const TEXT_ARTIFACT_EXTENSIONS = new Set([
  "txt",
  "log",
  "csv",
  "tsv",
  "json",
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

function artifactPath(url: string): string {
  return url.split(/[?#]/, 1)[0];
}

export function isTextArtifact(url: string): boolean {
  const extension = artifactPath(url).split(".").pop()?.toLowerCase();
  return extension !== undefined && TEXT_ARTIFACT_EXTENSIONS.has(extension);
}

export function artifactFilename(url: string): string {
  const basename = artifactPath(url).split("/").pop() ?? "";
  try {
    return decodeURIComponent(basename);
  } catch {
    return basename;
  }
}

export async function fetchArtifactText(
  url: string,
  authToken?: string,
): Promise<string> {
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `Failed to load this file (${response.status} ${response.statusText}).`,
    );
  }
  return response.text();
}
