/**
 * Constructs a module Web Worker that works even when the worker script is
 * served from a different origin than the page (e.g. JS bundles on a CDN
 * while the document is on the app origin).
 *
 * Browsers fetch the top-level worker script in `same-origin` mode, so a
 * cross-origin script URL is rejected with a `DOMException` thrown
 * synchronously inside `new Worker`. The fix is to build the worker from a
 * same-origin `blob:` URL whose only content is an ESM `import` of the real
 * (cross-origin) worker script. The blob inherits the page origin, satisfying
 * the same-origin check, and the cross-origin module import is permitted by
 * CORS. The worker's own relative imports keep resolving against the CDN.
 *
 * See https://github.com/vitejs/vite/issues/12662 and
 * https://github.com/vitejs/vite/issues/13680.
 */
export function createCrossOriginWorker(
  workerUrl: string,
  options?: WorkerOptions,
): Worker {
  const url = new URL(workerUrl, import.meta.url);
  const workerOptions: WorkerOptions = { type: "module", ...options };

  if (url.origin === self.location.origin) {
    return new Worker(url, workerOptions);
  }

  const source = `import ${JSON.stringify(url.href)};`;
  const blob = new Blob([source], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  const worker = new Worker(blobUrl, workerOptions);

  // The blob only needs to live until the worker has fetched it. Revoke on
  // error immediately, and best-effort after construction, to avoid leaking
  // object URLs.
  worker.addEventListener("error", () => URL.revokeObjectURL(blobUrl));
  setTimeout(() => URL.revokeObjectURL(blobUrl), 0);

  return worker;
}
