import type {
  GitHubBlob,
  GitHubCommit,
  GitHubFile,
  GitHubTreeItem,
} from "../types";

/**
 * Fetches files from a GitHub repository that match the provided filter
 *
 * @param pat - GitHub Personal Access Token for authentication
 * @param repository - Repository in "owner/repo" format
 * @param filterFn - Function to filter files by name (default: files ending with '.component.yaml')
 * @returns Promise of array of matched files with their content and metadata
 */
export async function fetchGitHubFiles(
  pat: string,
  repository: string,
  filterFn: (fileName: string) => boolean = (name) =>
    name.endsWith(".component.yaml"),
): Promise<GitHubFile[]> {
  const [owner, repo] = repository.split("/");

  if (!owner || !repo) {
    throw new Error('Repository must be in "owner/repo" format');
  }

  const headers = {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    // Step 1: Get the default branch
    const repoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers },
    );

    if (!repoResponse.ok) {
      throw new Error(
        `Failed to fetch repository: ${repoResponse.status} ${repoResponse.statusText}`,
      );
    }

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch;

    // Step 2: Get the tree for the default branch (recursively to get all files)
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      { headers },
    );

    if (!treeResponse.ok) {
      throw new Error(
        `Failed to fetch tree: ${treeResponse.status} ${treeResponse.statusText}`,
      );
    }

    const treeData = await treeResponse.json();
    const files: GitHubTreeItem[] = treeData.tree;

    // Step 3: Filter files based on the provided function
    const matchedFiles = files.filter(
      (file) => file.type === "blob" && filterFn(file.path),
    );

    // Step 4: Fetch content and last modified date for each matched file
    const filePromises = matchedFiles.map(async (file): Promise<GitHubFile> => {
      // Fetch file content
      const blobResponse = await fetch(file.url, { headers });

      if (!blobResponse.ok) {
        throw new Error(
          `Failed to fetch blob for ${file.path}: ${blobResponse.status}`,
        );
      }

      const blobData: GitHubBlob = await blobResponse.json();

      // Decode base64 content
      const content = atob(blobData.content);

      // Fetch last commit for this file to get the last modified date
      const commitsResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodeURIComponent(file.path)}&per_page=1`,
        { headers },
      );

      if (!commitsResponse.ok) {
        console.warn(
          `Failed to fetch commits for ${file.path}, using current date`,
        );
        return {
          repoName: repository,
          sha: file.sha,
          url: `https://github.com/${owner}/${repo}/blob/${defaultBranch}/${file.path}`,
          content,
          lastModified: new Date(),
        };
      }

      const commits: GitHubCommit[] = await commitsResponse.json();
      const lastModified =
        commits.length > 0
          ? new Date(commits[0].commit.committer.date)
          : new Date();

      return {
        repoName: repository,
        sha: file.sha,
        url: `https://github.com/${owner}/${repo}/blob/${defaultBranch}/${file.path}`,
        content,
        lastModified,
      };
    });

    // Wait for all file fetches to complete
    const results = await Promise.all(filePromises);

    return results;
  } catch (error) {
    throw new Error(
      `Failed to fetch GitHub files: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
