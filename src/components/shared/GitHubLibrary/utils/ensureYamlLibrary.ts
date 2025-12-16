import { LibraryDB } from "@/providers/ComponentLibraryProvider/libraries/storage";

import { getYamlLibraryId } from "./libraryId";

interface CreateYamlLibraryOptions {
  name: string;
  yamlUrl: string;
  accessToken: string;
}

export async function ensureYamlLibrary({
  name,
  yamlUrl,
  accessToken,
}: CreateYamlLibraryOptions) {
  const id = getYamlLibraryId(yamlUrl);

  const existingLibrary = await LibraryDB.component_libraries.get(id);

  if (existingLibrary) {
    return existingLibrary;
  }

  await LibraryDB.component_libraries.put({
    id,
    name,
    icon: "FolderGit",
    type: "yaml",
    knownDigests: [],
    configuration: {
      created_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      yaml_url: yamlUrl,
      access_token: accessToken,
      auto_update: true,
    },
    components: [],
  });

  return await LibraryDB.component_libraries.get(id);
}
