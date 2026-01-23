interface BugsnagConfig {
  enabled: boolean;
  apiKey: string;
  notifyEndpoint: string;
  sessionsEndpoint: string;
  customGroupingKey?: string;
}

const DEFAULT_NOTIFY_ENDPOINT = "https://notify.bugsnag.com";
const DEFAULT_SESSIONS_ENDPOINT = "https://sessions.bugsnag.com";

export const getBugsnagConfig = (): BugsnagConfig => {
  const apiKey = import.meta.env.VITE_BUGSNAG_API_KEY || "";
  const enabled = Boolean(apiKey);

  return {
    enabled,
    apiKey,
    notifyEndpoint:
      import.meta.env.VITE_BUGSNAG_NOTIFY_ENDPOINT || DEFAULT_NOTIFY_ENDPOINT,
    sessionsEndpoint:
      import.meta.env.VITE_BUGSNAG_SESSIONS_ENDPOINT ||
      DEFAULT_SESSIONS_ENDPOINT,
    customGroupingKey: import.meta.env.VITE_BUGSNAG_CUSTOM_GROUPING_KEY,
  };
};
