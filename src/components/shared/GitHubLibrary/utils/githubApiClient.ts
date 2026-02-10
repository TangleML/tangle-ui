const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";

/**
 * GitHub API error with additional context
 */
class GitHubApiError extends Error {
  name = "GitHubApiError";
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string,
    public originalError?: unknown,
  ) {
    super(message);
  }
}

/**
 * Type definitions for GitHub API responses
 * Based on GitHub REST API v3 structure
 */

/**
 * Represents a tree item from the GitHub Trees API
 * @see https://docs.github.com/en/rest/git/trees
 */
interface GitHubTreeItem {
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
interface GitHubBlob {
  sha: string;
  node_id: string;
  size: number;
  url: string;
  /**
   * Decoded content of the blob
   */
  content: string;
}

/**
 * GitHub API response types
 */
interface GitHubRepository {
  default_branch: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
  };
}

interface GitHubTree {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

/**
 * Configuration for the GitHub API client
 */
interface GitHubApiConfig {
  accessToken: string;
  apiBase?: string;
  apiVersion?: string;
}

/**
 * GitHub API Client class
 */
class GitHubApiClient {
  private readonly accessToken: string;
  private readonly apiBase: string;
  private readonly apiVersion: string;

  constructor(config: GitHubApiConfig) {
    this.accessToken = config.accessToken;
    this.apiBase = config.apiBase || GITHUB_API_BASE;
    this.apiVersion = config.apiVersion || GITHUB_API_VERSION;
  }

  /**
   * Get common headers for all GitHub API requests
   */
  private getHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: "application/vnd.github.v3+json",
      "X-GitHub-Api-Version": this.apiVersion,
    };
  }

  /**
   * Make a GitHub API request with error handling
   */
  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<T> {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.apiBase}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options?.headers,
        },
      });

      if (!response.ok) {
        let errorMessage = `GitHub API request failed: ${response.status} ${response.statusText}`;

        // Try to get more details from response body
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Ignore JSON parsing errors
        }

        throw new GitHubApiError(errorMessage, response.status, endpoint);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof GitHubApiError) {
        throw error;
      }

      throw new GitHubApiError(
        `Failed to fetch from GitHub API: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        endpoint,
        error,
      );
    }
  }

  /**
   * Get repository information
   */
  async getRepository(repository: string): Promise<GitHubRepository> {
    return this.request<GitHubRepository>(`/repos/${repository}`);
  }

  /**
   * Get repository tree
   */
  async getTree(
    repository: string,
    treeSha: string,
    recursive = false,
  ): Promise<GitHubTree> {
    const params = new URLSearchParams();
    if (recursive) params.append("recursive", "1");

    const queryString = params.toString();
    const endpoint = `/repos/${repository}/git/trees/${treeSha}${queryString ? `?${queryString}` : ""}`;

    return this.request<GitHubTree>(endpoint);
  }

  /**
   * Get blob by URL (supports full GitHub API URLs)
   */
  async getBlobContentByUrl(url: string): Promise<GitHubBlob> {
    const blob = await this.request<GitHubBlob>(url);
    return {
      ...blob,
      content: this.decodeContent(blob.content),
    };
  }

  /**
   * Decode base64 content from GitHub
   */
  decodeContent(content: string, encoding = "base64"): string {
    if (encoding === "base64") {
      return atob(content);
    }
    return content;
  }

  /**
   * Check if the client can access a repository
   */
  async checkAccess(repository: string): Promise<boolean> {
    try {
      await this.getRepository(repository);
      return true;
    } catch (error) {
      if (error instanceof GitHubApiError && error.statusCode === 404) {
        return false;
      }
      throw error;
    }
  }
}

/**
 * Factory function to create a GitHub API client
 */
export function createGitHubApiClient(
  accessToken: string,
  config?: Partial<GitHubApiConfig>,
): GitHubApiClient {
  return new GitHubApiClient({
    accessToken,
    ...config,
  });
}
