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

interface YamlLibraryConfiguration {
  created_at: string;
  last_updated_at: string;
  yaml_url: string;
  access_token: string | undefined;
  auto_update: boolean;
}

export function isYamlLibraryConfiguration(
  configuration: any,
): configuration is YamlLibraryConfiguration {
  return (
    typeof configuration === "object" &&
    configuration !== null &&
    "created_at" in configuration &&
    "last_updated_at" in configuration &&
    "yaml_url" in configuration &&
    "auto_update" in configuration
  );
}
