import { env } from "@/schemas/env";

export function isGitHubAuthEnabled() {
  return env.VITE_GITHUB_CLIENT_ID !== "";
}
