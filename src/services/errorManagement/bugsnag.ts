import Bugsnag, { type BrowserConfig, type Event } from "@bugsnag/js";
import BugsnagPluginReact from "@bugsnag/plugin-react";

import { normalizeErrorMessage } from "./normalizeErrorMessage";

const BUGSNAG_API_KEY = import.meta.env.VITE_BUGSNAG_API_KEY || "";
const BUGSNAG_NOTIFY_ENDPOINT =
  import.meta.env.VITE_BUGSNAG_NOTIFY_ENDPOINT || "https://notify.bugsnag.com";
const BUGSNAG_SESSIONS_ENDPOINT =
  import.meta.env.VITE_BUGSNAG_SESSIONS_ENDPOINT ||
  "https://sessions.bugsnag.com";
const BUGSNAG_CUSTOM_GROUPING_KEY = import.meta.env
  .VITE_BUGSNAG_CUSTOM_GROUPING_KEY;

const GENERIC_ERROR_CLASS = "Error";

const getBugsnagConfig = (): BrowserConfig => {
  return {
    apiKey: BUGSNAG_API_KEY,
    endpoints: {
      notify: BUGSNAG_NOTIFY_ENDPOINT,
      sessions: BUGSNAG_SESSIONS_ENDPOINT,
    },
    plugins: [new BugsnagPluginReact()],
    onError: handleBugsnagError,
  };
};

export const handleBugsnagError = (event: Event): void => {
  if (
    event.errors.length > 0 &&
    event.errors[0].errorClass === GENERIC_ERROR_CLASS
  ) {
    const errorMessage = event.errors[0].errorMessage;
    const { normalizedMessage, extractedValues } =
      normalizeErrorMessage(errorMessage);

    event.groupingHash = normalizedMessage;
    event.errors[0].errorClass = normalizedMessage;

    if (BUGSNAG_CUSTOM_GROUPING_KEY) {
      event.addMetadata("custom", {
        [BUGSNAG_CUSTOM_GROUPING_KEY]: normalizedMessage,
      });
    }

    if (Object.keys(extractedValues).length > 0) {
      event.addMetadata("extracted_values", extractedValues);
    }
  }

  event.addMetadata("context", { pathname: window.location.pathname });
};

export const initializeBugsnag = (): void => {
  if (!BUGSNAG_API_KEY) {
    return;
  }

  try {
    Bugsnag.start(getBugsnagConfig());
  } catch (error) {
    console.error("Failed to initialize Bugsnag:", error);
  }
};
