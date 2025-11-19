interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  path: string;
  branch?: string;
}

/**
 * Parse GitHub URL to extract owner, repo, path, and branch
 */
export function parseGitHubUrl(url: string): ParsedGitHubUrl {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;
  const pathname = urlObj.pathname;
  const parts = pathname.split("/").filter(Boolean);

  let owner = "";
  let repo = "";
  let path = "";
  let branch: string | undefined;

  if (hostname === "raw.githubusercontent.com") {
    owner = parts[0];
    repo = parts[1];

    if (parts[2] === "refs" && parts[3] === "heads") {
      branch = parts[4];
      path = parts.slice(5).join("/");
    } else if (parts[2] === "refs" && parts[3] === "tags") {
      branch = `tags/${parts[4]}`;
      path = parts.slice(5).join("/");
    } else {
      branch = parts[2];
      path = parts.slice(3).join("/");
    }
  } else if (hostname === "github.com" || hostname === "www.github.com") {
    owner = parts[0];
    repo = parts[1];

    if (["blob", "tree", "raw", "blame", "edit"].includes(parts[2])) {
      branch = parts[3];
      path = parts.slice(4).join("/");
    }
  } else if (hostname === "api.github.com") {
    if (parts[0] === "repos" && parts[3] === "contents") {
      owner = parts[1];
      repo = parts[2];
      path = parts.slice(4).join("/");
      const ref = urlObj.searchParams.get("ref");
      if (ref) branch = ref;
    }
  }

  if (!owner || !repo) {
    throw new Error(
      `Invalid GitHub URL: Could not extract owner and repo from ${url}`,
    );
  }

  return { owner, repo, path, branch };
}
