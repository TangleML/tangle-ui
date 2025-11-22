/**
 * Type definitions for GitHub API responses
 * Based on GitHub REST API v3 structure
 */

/**
 * Represents a tree item from the GitHub Trees API
 * @see https://docs.github.com/en/rest/git/trees
 */
export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  size?: number;
  sha: string;
  url: string;
}

/**
 * Represents a blob (file content) from the GitHub Blobs API
 * @see https://docs.github.com/en/rest/git/blobs
 */
export interface GitHubBlob {
  sha: string;
  node_id: string;
  size: number;
  url: string;
  content: string; // Base64 encoded content
  encoding: string;
}

/**
 * Represents a processed GitHub file with content and metadata
 * This is the return type of fetchGitHubFiles function
 */
export interface GitHubFile {
  repoName: string;
  sha: string;
  url: string;
  content: string;
}

interface GitHubLibraryConfiguration {
  created_at: string;
  last_updated_at: string;
  repo_name: string;
  access_token: string;
  auto_update: boolean;
}

export function isGitHubLibraryConfiguration(
  configuration: any,
): configuration is GitHubLibraryConfiguration {
  return (
    typeof configuration === "object" &&
    configuration !== null &&
    "created_at" in configuration &&
    "last_updated_at" in configuration &&
    "repo_name" in configuration &&
    "access_token" in configuration &&
    "auto_update" in configuration
  );
}
