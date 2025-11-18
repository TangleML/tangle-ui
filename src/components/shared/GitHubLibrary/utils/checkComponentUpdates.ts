import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";
import {
  generateDigest,
  hydrateComponentReference,
} from "@/services/componentService";
import type { HydratedComponentReference } from "@/utils/componentSpec";

import { parseGitHubUrl } from "./githubUrl";

class GitHubUpdateCheckError extends Error {
  name = "GitHubUpdateCheckError";
  constructor(message: string) {
    super(message);
  }
}

export async function checkComponentUpdates(
  component: HydratedComponentReference,
  library: StoredLibrary,
) {
  if (library.type != "github") {
    return false;
  }

  const accessToken = library.configuration?.access_token;

  if (!accessToken) {
    return false;
  }

  if (!component.url) {
    return false;
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const { owner, repo, path: componentPath } = parseGitHubUrl(component.url);

  const apiUrl = new URL(
    `https://api.github.com/repos/${owner}/${repo}/contents/${componentPath}`,
  );

  const response = await fetch(apiUrl.toString(), { headers });

  if (!response.ok) {
    return false;
  }

  const data = await response.json();

  if (data.content && data.encoding === "base64") {
    // works only in browser, not in node
    const decodedText = atob(data.content);

    const digest = await generateDigest(decodedText);

    if (digest === component.digest) {
      return false;
    }

    return await hydrateComponentReference({
      text: decodedText,
      url: component.url,
    });
  }

  throw new GitHubUpdateCheckError(
    "Unexpected response format from GitHub API",
  );
}
