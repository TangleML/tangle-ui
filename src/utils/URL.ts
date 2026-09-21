import { APP_ROUTES } from "@/routes/appRoutes";
import { RUNS_BASE_PATH } from "@/routes/router";
import { BASE_URL, IS_GITHUB_PAGES } from "@/utils/constants";

const convertGcsUrlToBrowserUrl = (
  url: string,
  isDirectory: boolean,
): string => {
  if (!url.startsWith("gs://")) {
    return url;
  }

  if (isDirectory) {
    return url.replace(
      "gs://",
      "https://console.cloud.google.com/storage/browser/",
    );
  }
  return url.replace("gs://", "https://storage.cloud.google.com/");
};

const convertHfUrlToDirectoryUrl = (url: string, isDirectory: boolean) => {
  if (!url.startsWith("hf://")) {
    return url;
  }

  /**
   * Common Hugging Face URL format:
   *
   * hf://<repo-type-plural>/<user>/<repo>/<path>
   *
   * e.g. `hf://datasets/Ark-kun/tangle_data/path/a/b/c`
   */
  const hfUrl = url.replace("hf://", "");

  const urlParts = hfUrl.split("/");
  const repoTypePlural = urlParts[0];
  const user = urlParts[1];
  const repo = urlParts[2];
  const path = urlParts.slice(3).join("/");

  if (isDirectory) {
    return `https://huggingface.co/${repoTypePlural}/${user}/${repo}/tree/main/${path}`;
  } else {
    return `https://huggingface.co/${repoTypePlural}/${user}/${repo}/blob/main/${path}`;
  }
};

const convertArtifactUriToHTTPUrl = (
  artifactUrl: string,
  isDirectory: boolean,
) => {
  if (artifactUrl.startsWith("gs://")) {
    return convertGcsUrlToBrowserUrl(artifactUrl, isDirectory);
  } else if (artifactUrl.startsWith("hf://")) {
    return convertHfUrlToDirectoryUrl(artifactUrl, isDirectory);
  } else {
    return artifactUrl;
  }
};

const convertRawUrlToDirectoryUrl = (rawUrl: string) => {
  const urlPattern =
    /^https:\/\/raw.githubusercontent.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/;
  const match = rawUrl.match(urlPattern);

  if (match) {
    const user = match[1];
    const repo = match[2];
    const commitHash = match[3];
    const filePath = match[4];
    const directoryPath = filePath.substring(0, filePath.lastIndexOf("/"));

    const directoryUrl = `https://github.com/${user}/${repo}/tree/${commitHash}/${directoryPath}`;
    return directoryUrl;
  } else {
    throw new Error("Invalid GitHub raw URL");
  }
};

const convertWebUrlToDirectoryUrl = (webUrl: string) => {
  const urlPattern =
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/;
  const match = webUrl.match(urlPattern);

  if (match) {
    const user = match[1];
    const repo = match[2];
    const commitHash = match[3];
    const filePath = match[4];
    const directoryPath = filePath.substring(0, filePath.lastIndexOf("/"));

    return `https://github.com/${user}/${repo}/tree/${commitHash}/${directoryPath}`;
  } else {
    throw new Error("Invalid GitHub web URL");
  }
};

const isGithubUrl = (url: string) => {
  return (
    url.startsWith("https://raw.githubusercontent.com/") ||
    url.startsWith("https://github.com/")
  );
};

const convertGithubUrlToDirectoryUrl = (url: string) => {
  if (url.startsWith("https://raw.githubusercontent.com/")) {
    return convertRawUrlToDirectoryUrl(url);
  } else if (url.startsWith("https://github.com/") && url.includes("/blob/")) {
    return convertWebUrlToDirectoryUrl(url);
  } else {
    throw new Error("Unsupported GitHub URL format");
  }
};

const buildComponentSourceUrl = ({
  remoteUrl,
  branch,
  relativeDir,
  filePath,
}: {
  remoteUrl: string;
  branch: string;
  relativeDir: string;
  filePath: string;
}): string => {
  const baseUrl = remoteUrl.replace(/\/+$/, "").replace(/\.git$/, "");
  const pathParts = [
    "blob",
    branch.replace(/^\/+|\/+$/g, ""),
    relativeDir.replace(/^\/+|\/+$/g, ""),
    filePath.replace(/^\/+|\/+$/g, ""),
  ];

  return `${baseUrl}/${pathParts.join("/")}`;
};

const downloadBlobAsFile = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const downloadStringAsFile = (
  content: string,
  filename: string,
  contentType: string,
) => {
  downloadBlobAsFile(new Blob([content], { type: contentType }), filename);
};

const downloadYamlFromComponentText = (text: string, displayName: string) => {
  downloadStringAsFile(text, `${displayName}.yaml`, "text/yaml");
};

const getIdOrTitleFromPath = (
  pathname: string,
): {
  id?: string;
  title?: string;
} => {
  const isRunPath = pathname.includes(RUNS_BASE_PATH);

  const lastPathSegment = pathname.split("/").pop() || "";
  const isId = lastPathSegment.match(/^[0-9a-fA-F]{20}$/) || isRunPath;
  const decodedSegment = decodeURIComponent(lastPathSegment);

  if (decodedSegment === "") {
    return { id: undefined, title: undefined };
  }

  return {
    id: isId ? decodedSegment : undefined,
    title: isId ? undefined : decodedSegment,
  };
};

const MAX_URL_LENGTH = 2048;

const parseHttpUrl = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH || /\s/.test(trimmed)) {
    return undefined;
  }

  try {
    const { protocol } = new URL(trimmed);
    return protocol === "http:" || protocol === "https:" ? trimmed : undefined;
  } catch {
    return undefined;
  }
};

const toAbsoluteHttpUrl = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
};

const normalizeUrl = (url: string) => {
  if (url.trim() === "") {
    return "";
  }

  let normalizedUrl = url.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = "http://" + normalizedUrl;
  }
  return normalizedUrl;
};

const buildAbsoluteAppUrl = (path: string): string => {
  const basepath = BASE_URL.replace(/\/$/, "");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return IS_GITHUB_PAGES
    ? `${origin}${basepath}/#${path}`
    : `${origin}${basepath}${path}`;
};

const getArtifactPreviewUrl = (
  artifactId: string,
  type?: string,
  name?: string,
): string => {
  const search = new URLSearchParams();
  if (type) search.set("type", type);
  if (name) search.set("name", name);
  const query = search.toString() ? `?${search}` : "";

  return buildAbsoluteAppUrl(
    `/artifact/${encodeURIComponent(artifactId)}${query}`,
  );
};

const getExecutionLogsUrl = (executionId: string | number): string =>
  buildAbsoluteAppUrl(`/logs/${encodeURIComponent(executionId)}`);

const getRawExecutionLogsUrl = (
  executionId: string | number,
  backendUrl: string,
): string =>
  `${backendUrl}/api/executions/${encodeURIComponent(executionId)}/stream_container_log`;

/**
 * Where a project card goes, which is where someone following a shared link
 * expects to arrive. Its own page is reachable from there, so linking to the
 * details page instead would leave two links for one project and hand over the
 * one nobody navigates to.
 */
const getProjectUrl = (projectId: string): string =>
  buildAbsoluteAppUrl(
    APP_ROUTES.TANGENT_PROJECT.replace(
      "$projectId",
      encodeURIComponent(projectId),
    ),
  );

export {
  buildComponentSourceUrl,
  convertArtifactUriToHTTPUrl,
  convertGcsUrlToBrowserUrl,
  convertGithubUrlToDirectoryUrl,
  convertHfUrlToDirectoryUrl,
  downloadBlobAsFile,
  downloadStringAsFile,
  downloadYamlFromComponentText,
  getArtifactPreviewUrl,
  getExecutionLogsUrl,
  getIdOrTitleFromPath,
  getProjectUrl,
  getRawExecutionLogsUrl,
  isGithubUrl,
  normalizeUrl,
  parseHttpUrl,
  toAbsoluteHttpUrl,
};
