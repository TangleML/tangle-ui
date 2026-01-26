import Bugsnag, { type Event } from "@bugsnag/js";
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
const GENERIC_ERROR_CLASS = "Error";

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
 * Handle Bugsnag error events with custom normalization and grouping.
 * Exported for testing purposes.
 *
 * @param event - The Bugsnag error event
 * @param config - Bugsnag configuration
 */
export const handleBugsnagError = (
  event: Event,
  config: Pick<BugsnagConfig, "customGroupingKey">,
): void => {
  // Only normalize and enhance generic "Error" instances
  // Custom error classes (NetworkError, ValidationError, etc.) are preserved as-is
  if (event.errors[0].errorClass === GENERIC_ERROR_CLASS) {
    const errorMessage = event.errors[0].errorMessage;
    const { normalizedMessage, extractedValues } =
      normalizeErrorMessage(errorMessage);

    // Set custom grouping hash for better error grouping
    event.groupingHash = normalizedMessage;

    // Update errorClass to show the normalized message in Observe UI
    event.errors[0].errorClass = normalizedMessage;

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
  }

  // Add pathname for context (for all errors)
  event.addMetadata("context", { pathname: window.location.pathname });
};

/**
 * Initialize Bugsnag with custom error normalization and grouping.
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
      onError: (event) => handleBugsnagError(event, config),
    });
  } catch (error) {
    console.error("Failed to initialize Bugsnag:", error);
  }
};
