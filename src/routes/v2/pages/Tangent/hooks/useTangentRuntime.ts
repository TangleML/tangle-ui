import { useEffect, useState } from "react";

export type TangentRuntimeStatus = "loading" | "ready" | "unreachable";

export function tangentChannelUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/embed/v1/tangent-elements.js`;
}

/**
 * Tangent's UI is a bundle fetched from its own origin at runtime, and
 * `TangentProvider` waits on that import without watching for it to fail — a
 * Tangent that is not running leaves the page blank forever. Importing it here
 * too is what makes the failure visible: module imports are cached per URL, so
 * the provider's own import resolves against this one rather than fetching
 * twice. Pass the same url to the provider so the two cannot disagree about
 * what was tried.
 *
 * A failed import stays failed for the life of the document, so recovering
 * means reloading the page rather than calling this again.
 */
export function useTangentRuntime(channelUrl: string): TangentRuntimeStatus {
  const [status, setStatus] = useState<TangentRuntimeStatus>("loading");

  useEffect(() => {
    let active = true;
    setStatus("loading");

    void import(/* @vite-ignore */ channelUrl).then(
      () => {
        if (active) setStatus("ready");
      },
      () => {
        if (active) setStatus("unreachable");
      },
    );

    return () => {
      active = false;
    };
  }, [channelUrl]);

  return status;
}
