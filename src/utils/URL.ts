import { RUNS_BASE_PATH } from "@/routes/router";

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

const downloadStringAsFile = (
  content: string,
  filename: string,
  contentType: string,
) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

export {
  convertArtifactUriToHTTPUrl,
  convertGcsUrlToBrowserUrl,
  convertGithubUrlToDirectoryUrl,
  convertHfUrlToDirectoryUrl,
  downloadStringAsFile,
  downloadYamlFromComponentText,
  getIdOrTitleFromPath,
  isGithubUrl,
  normalizeUrl,
};
