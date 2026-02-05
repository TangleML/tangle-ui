import Bugsnag, { type BrowserConfig, type Event } from "@bugsnag/js";
import BugsnagPluginReact from "@bugsnag/plugin-react";

const BUGSNAG_API_KEY = import.meta.env.VITE_BUGSNAG_API_KEY || "";
const BUGSNAG_NOTIFY_ENDPOINT =
  import.meta.env.VITE_BUGSNAG_NOTIFY_ENDPOINT || "https://notify.bugsnag.com";
const BUGSNAG_SESSIONS_ENDPOINT =
  import.meta.env.VITE_BUGSNAG_SESSIONS_ENDPOINT ||
  "https://sessions.bugsnag.com";

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
