import { useEffect, useState } from "react";

export type TangentRuntimeStatus = "loading" | "ready" | "unreachable";

export function tangentChannelUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/embed/v1/tangent-elements.js`;
}

/**
 * `TangentProvider` awaits its runtime bundle without watching for the import
 * to fail, so a runtime that is not there leaves the page blank forever.
 * Importing it here as well is what makes the failure visible: imports are
 * cached per URL, so the provider resolves against this one rather than
 * fetching twice. Pass it the same url, or the two disagree about what was
 * tried.
 *
 * A failed import stays failed for the life of the document, so recovery is a
 * page reload rather than another call.
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
