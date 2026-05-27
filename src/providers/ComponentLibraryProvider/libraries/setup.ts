import { GitHubFlatComponentLibrary } from "@/components/shared/GitHubLibrary/githubFlatComponentLibrary";
import { isGitHubLibraryConfiguration } from "@/components/shared/GitHubLibrary/types";

import { registerLibraryFactory } from "./factory";

/**
 * Idempotent registration of library factories. The provider already registers
 * the same factories at module load, but the dashboard search page reads
 * libraries from Dexie directly (without mounting `ComponentLibraryProvider`,
 * which is editor-scoped and depends on `ComponentSpecProvider`). Anywhere
 * that needs to instantiate a stored library can call this first.
 */
let registered = false;

export function ensureLibraryFactoriesRegistered() {
  if (registered) return;

  registerLibraryFactory("github", (library) => {
    if (!isGitHubLibraryConfiguration(library.configuration)) {
      throw new Error(
        `GitHub library configuration is not valid for "${library.id}"`,
      );
    }
    return new GitHubFlatComponentLibrary(library.configuration.repo_name);
  });

  registered = true;
}
