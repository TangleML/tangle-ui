import { createGitHubApiClient } from "@/services/github/githubApiClient";

export async function checkPATStatus(repository: string, pat: string) {
  return createGitHubApiClient(pat).checkAccess(repository);
}
