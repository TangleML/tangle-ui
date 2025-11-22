/**
 * Get the ID of a GitHub library
 * @param repoName - The name of the GitHub repository
 * @returns The ID of the GitHub library
 */
export function getGitHubLibraryId(repoName: string) {
  return `github__${repoName.toLowerCase().replace(/ /g, "_")}`;
}
