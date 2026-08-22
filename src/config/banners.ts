import { isRecord } from "@/utils/typeGuards";

export interface TangleBannerAction {
  url: string;
  text: string;
}

export interface TangleBanner {
  id: string;
  title: string;
  body: string;
  variant: "info" | "warning" | "success" | "error";
  dismissible?: boolean;
  action?: TangleBannerAction;
}

/**
 * Host extension point. A page embedding this app may install a banner source on
 * `window` to publish notices into the UI; with none installed the feature is
 * invisible. The shape is React's `(subscribe, getSnapshot)` store contract so
 * updates reach the screen while the page stays open, and `body` is Markdown
 * that is never trusted.
 */
export interface TangleBannerSource {
  version: 1;
  getSnapshot: () => TangleBanner[];
  subscribe: (listener: () => void) => () => void;
  refresh?: () => void;
}

declare global {
  interface Window {
    __TANGLE_BANNER_SOURCE__?: TangleBannerSource;
  }
}

export const BANNER_SOURCE_EVENT = "tangle:banner-source";

const SUPPORTED_SOURCE_VERSION = 1;
const VARIANTS: TangleBanner["variant"][] = [
  "info",
  "warning",
  "success",
  "error",
];
const DEFAULT_ACTION_TEXT = "Learn more";

const EMPTY_BANNERS: readonly TangleBanner[] = Object.freeze([]);

let lastRawSnapshot: unknown = null;
let lastValidatedSnapshot: readonly TangleBanner[] = EMPTY_BANNERS;

function isBannerSource(value: unknown): value is TangleBannerSource {
  return (
    isRecord(value) &&
    value.version === SUPPORTED_SOURCE_VERSION &&
    typeof value.getSnapshot === "function" &&
    typeof value.subscribe === "function"
  );
}

function getBannerSource(): TangleBannerSource | null {
  if (typeof window === "undefined") return null;
  const source: unknown = window.__TANGLE_BANNER_SOURCE__;
  return isBannerSource(source) ? source : null;
}

export function toAbsoluteHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function readTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readId(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return readTrimmedString(value);
}

function readVariant(value: unknown): TangleBanner["variant"] {
  return VARIANTS.find((variant) => variant === value) ?? "info";
}

function readAction(value: unknown): TangleBannerAction | null {
  if (!isRecord(value)) return null;

  const url = toAbsoluteHttpUrl(value.url);
  if (!url) return null;

  return { url, text: readTrimmedString(value.text) || DEFAULT_ACTION_TEXT };
}

function readBanner(value: unknown): TangleBanner | null {
  if (!isRecord(value)) return null;

  const id = readId(value.id);
  if (!id) return null;

  const title = readTrimmedString(value.title);
  const body = typeof value.body === "string" ? value.body : "";
  if (!title && !body.trim()) return null;

  const action = readAction(value.action);

  return {
    id,
    title,
    body,
    variant: readVariant(value.variant),
    ...(value.dismissible === true ? { dismissible: true } : {}),
    ...(action ? { action } : {}),
  };
}

function readRawSnapshot(): unknown {
  const source = getBannerSource();
  if (!source) return null;
  try {
    return source.getSnapshot();
  } catch {
    return null;
  }
}

export function getBannersSnapshot(): readonly TangleBanner[] {
  const raw = readRawSnapshot();
  if (!Array.isArray(raw)) return EMPTY_BANNERS;

  /**
   * `useSyncExternalStore` re-renders whenever the snapshot reference differs,
   * and validation allocates, so the result must be cached against the raw
   * array and the empty case must always be the same reference. Returning a
   * fresh array per read is an infinite render loop, not a slow render.
   */
  if (raw === lastRawSnapshot) return lastValidatedSnapshot;

  lastRawSnapshot = raw;
  const validated = raw
    .map(readBanner)
    .filter((banner): banner is TangleBanner => banner !== null);
  lastValidatedSnapshot =
    validated.length === 0 ? EMPTY_BANNERS : Object.freeze(validated);

  return lastValidatedSnapshot;
}

function subscribeToSource(listener: () => void): (() => void) | null {
  const source = getBannerSource();
  if (!source) return null;
  try {
    const unsubscribe = source.subscribe(listener);
    return typeof unsubscribe === "function" ? unsubscribe : null;
  } catch {
    return null;
  }
}

export function subscribeToBanners(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  let unsubscribe = subscribeToSource(listener);

  const rebindToSource = () => {
    unsubscribe?.();
    unsubscribe = subscribeToSource(listener);
    listener();
  };

  window.addEventListener(BANNER_SOURCE_EVENT, rebindToSource);

  return () => {
    unsubscribe?.();
    window.removeEventListener(BANNER_SOURCE_EVENT, rebindToSource);
  };
}

export function refreshBanners(): void {
  const source = getBannerSource();
  if (typeof source?.refresh !== "function") return;
  try {
    source.refresh();
  } catch {
    // A host that fails to re-fetch must not surface an error in the app.
  }
}
