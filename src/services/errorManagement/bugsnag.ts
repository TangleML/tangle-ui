import Bugsnag, { type Event } from "@bugsnag/js";
import BugsnagPluginReact from "@bugsnag/plugin-react";

interface BugsnagConfig {
  enabled: boolean;
  apiKey: string;
  notifyEndpoint: string;
  sessionsEndpoint: string;
}

const DEFAULT_NOTIFY_ENDPOINT = "https://notify.bugsnag.com";
const DEFAULT_SESSIONS_ENDPOINT = "https://sessions.bugsnag.com";

const getBugsnagConfig = (): BugsnagConfig => {
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
  };
};

/**
 * Handle Bugsnag error events with basic context.
 * Exported for testing purposes.
 *
 * @param event - The Bugsnag error event
 */
export const handleBugsnagError = (event: Event): void => {
  // Add pathname for context
  event.addMetadata("context", { pathname: window.location.pathname });
};

/**
 * Initialize Bugsnag for error reporting.
 * Call this function early in your application lifecycle to enable error reporting.
 */
export const initializeBugsnag = (): void => {
  const config = getBugsnagConfig();

  if (!config.enabled) {
    return;
  }

  try {
    Bugsnag.start({
      apiKey: config.apiKey,
      endpoints: {
        notify: config.notifyEndpoint,
        sessions: config.sessionsEndpoint,
      },
      plugins: [new BugsnagPluginReact()],
      onError: handleBugsnagError,
    });
  } catch (error) {
    console.error("Failed to initialize Bugsnag:", error);
  }
};
