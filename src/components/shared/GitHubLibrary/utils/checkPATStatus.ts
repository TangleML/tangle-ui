import { createGitHubApiClient } from "./githubApiClient";

export async function checkPATStatus(repository: string, pat: string) {
  return createGitHubApiClient(pat).checkAccess(repository);
}
