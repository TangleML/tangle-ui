import { createGitHubApiClient } from "./githubApiClient";

/**
 * Fetches files from a GitHub repository that match the provided filter
 *
 * @param pat - GitHub Personal Access Token for authentication
 * @param repository - Repository in "owner/repo" format
 * @param filterFn - Function to filter files by name
 * @returns Promise of array of matched files with their content and metadata
 */
export async function fetchGitHubFiles(
  pat: string,
  repository: string,
  filterFn: (fileName: string) => boolean,
) {
  const client = createGitHubApiClient(pat);
  try {
    // Step 1: Get the default branch
    const repoData = await client.getRepository(repository);
    const defaultBranch = repoData.default_branch;

    // Step 2: Get the tree for the default branch (recursively to get all files)
    const treeData = await client.getTree(repository, defaultBranch, true);
    const files = treeData.tree;

    // Step 3: Filter files based on the provided function
    const matchedFiles = files.filter(
      (file) => file.type === "blob" && filterFn(file.path),
    );

    // Step 4: Fetch content for each matched file
    const filePromises = matchedFiles.map(async (file) => {
      const blobData = await client.getBlobContentByUrl(file.url);

      return {
        repoName: repository,
        sha: file.sha,
        url: `https://github.com/${repository}/blob/${defaultBranch}/${file.path}`,
        content: blobData.content,
      };
    });

    // Wait for all file fetches to complete
    return await Promise.all(filePromises);
  } catch (error) {
    throw new Error(
      `Failed to fetch GitHub files: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
