export function isGitHubAuthEnabled() {
  return (
    !!import.meta.env.VITE_GITHUB_CLIENT_ID &&
    import.meta.env.VITE_GITHUB_CLIENT_ID !== ""
  );
}
