export function validatePAT(token: string): string[] | null {
  if (!token) return ["Personal Access Token is required"];
  // Basic PAT validation - GitHub PATs start with ghp_ or github_pat_
  return token.startsWith("ghp_") || token.startsWith("github_pat_")
    ? null
    : ["Invalid Personal Access Token. Must start with ghp_ or github_pat_"];
}
