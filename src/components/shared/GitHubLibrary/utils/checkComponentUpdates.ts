import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";
import { hydrateComponentReference } from "@/services/componentService";
import { createGitHubApiClient } from "@/services/github/githubApiClient";
import type { HydratedComponentReference } from "@/utils/componentSpec";
import { generateDigest } from "@/utils/componentStore";

import { isGitHubLibraryConfiguration } from "../types";

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
  if (
    library.type != "github" ||
    !isGitHubLibraryConfiguration(library.configuration) ||
    !component.url
  ) {
    return false;
  }

  try {
    const client = createGitHubApiClient(library.configuration.access_token);

    const data = await client.getBlobContentByUrl(component.url);

    const digest = await generateDigest(data.content);

    if (digest === component.digest) {
      return false;
    }

    return await hydrateComponentReference({
      text: data.content,
      url: component.url,
    });
  } catch (error) {
    if (error instanceof GitHubUpdateCheckError) {
      throw error;
    }
    return false;
  }
}
