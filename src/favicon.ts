const STATUS_FAVICONS = {
  success: "/favicon-success.ico",
  failed: "/favicon-failed.ico",
  loading: "/favicon-loading.ico",
  paused: "/favicon-paused.ico",
};

type FaviconStatus = keyof typeof STATUS_FAVICONS | "default";

class FaviconManager {
  private defaultFavicon = "/favicon.ico";

  updateFavicon(status: FaviconStatus) {
    const link =
      (document.querySelector("link[rel*='icon']") as HTMLLinkElement) ||
      document.createElement("link");

    link.type = "image/x-icon";
    link.rel = "shortcut icon";
    link.href =
      status === "default" ? this.defaultFavicon : STATUS_FAVICONS[status];

    if (!document.querySelector("link[rel*='icon']")) {
      document.getElementsByTagName("head")[0].appendChild(link);
    }
  }

  reset() {
    this.updateFavicon("default");
  }
}

export const faviconManager = new FaviconManager();

export const getFaviconStatus = (
  executionStatus: string | undefined,
): FaviconStatus => {
  switch (executionStatus) {
    case "SUCCEEDED":
      return "success";
    case "FAILED":
    case "SYSTEM_ERROR":
    case "INVALID":
      return "failed";
    case "RUNNING":
    case "PENDING":
    case "QUEUED":
    case "WAITING_FOR_UPSTREAM":
    case "CANCELLING":
    case "UNINITIALIZED":
      return "loading";
    case "CANCELLED":
    case "SKIPPED":
      return "paused";
    default:
      return "default";
  }
};
