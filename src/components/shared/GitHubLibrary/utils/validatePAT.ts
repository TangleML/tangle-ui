export function validatePAT(token: string): string[] | null {
  const trimmedToken = token.trim();
  if (!trimmedToken) return null;
  // Basic PAT validation - GitHub PATs start with ghp_ or github_pat_
  return trimmedToken.startsWith("ghp_") ||
    trimmedToken.startsWith("github_pat_")
    ? null
    : ["Invalid Personal Access Token. Must start with ghp_ or github_pat_"];
}
