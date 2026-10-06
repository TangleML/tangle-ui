import { useEffect, useState } from "react";

export type TangentRuntimeStatus = "loading" | "ready" | "unreachable";

export function tangentChannelUrl(baseUrl: string | null): string | null {
  if (!baseUrl) return null;
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
 *
 * A null url means the caller does not know where Tangent is yet, which is not
 * the same as it being absent: importing a guessed url is what the caller is
 * avoiding, so this stays on `loading` until it is given one.
 */
export function useTangentRuntime(
  channelUrl: string | null,
): TangentRuntimeStatus {
  const [status, setStatus] = useState<TangentRuntimeStatus>("loading");

  useEffect(() => {
    if (!channelUrl) return;

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
