import Bugsnag from "@bugsnag/js";
import BugsnagPluginReact from "@bugsnag/plugin-react";

import { normalizeErrorMessage } from "./normalizeErrorMessage";

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

/**
 * Initialize Bugsnag with custom error normalization and grouping.
 */
const initializeBugsnag = () => {
  const config = getBugsnagConfig();

  if (!config.enabled) {
    return;
  }

  Bugsnag.start({
    apiKey: config.apiKey,
    endpoints: {
      notify: config.notifyEndpoint,
      sessions: config.sessionsEndpoint,
    },
    plugins: [new BugsnagPluginReact()],

    // Apply custom normalization to all errors for better grouping
    onError: (event) => {
      const errorMessage = event.errors[0].errorMessage;
      const { normalizedMessage, extractedValues } =
        normalizeErrorMessage(errorMessage);

      // Set custom grouping hash for better error grouping
      event.groupingHash = normalizedMessage;

      // Add custom grouping key to metadata if configured
      if (config.customGroupingKey) {
        event.addMetadata("custom", {
          [config.customGroupingKey]: normalizedMessage,
        });
      }

      // Add extracted values as metadata for debugging
      if (Object.keys(extractedValues).length > 0) {
        event.addMetadata("extracted_values", extractedValues);
      }

      // Add pathname for context
      event.addMetadata("context", { pathname: window.location.pathname });
    },
  });
};

// Initialize Bugsnag on module load
initializeBugsnag();
