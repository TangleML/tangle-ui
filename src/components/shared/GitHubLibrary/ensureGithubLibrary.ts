import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";
import type { HydratedComponentReference } from "@/utils/componentSpec";

import { getGitHubLibraryId } from "./utils/libraryId";

interface CreateGithubLibraryOptions {
  repoName: string;
  accessToken: string;
  components: HydratedComponentReference[];
}

export async function createGithubLibrary({
  repoName,
  accessToken,
  components,
}: CreateGithubLibraryOptions) {
  const id = getGitHubLibraryId(repoName);

  const existingLibrary = await LibraryDB.component_libraries.get(id);

  if (existingLibrary) {
    return existingLibrary;
  }

  await LibraryDB.component_libraries.put({
    id,
    name: repoName,
    icon: "Github",
    type: "github",
    knownDigests: components.map((component) => component.digest),
    configuration: {
      created_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      repo_name: repoName,
      access_token: accessToken,
      auto_update: true,
    },
    components: components.map((component) => ({
      digest: component.digest,
      name: component.name,
      url: component.url,
    })),
  });

  return await LibraryDB.component_libraries.get(id);
}
