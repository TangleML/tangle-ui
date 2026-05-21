/**
 * Resolves when an element matching `selector` is present in the DOM, or
 * after `timeoutMs` if it never appears. Used to defer reactour activation
 * until a target view (e.g. the editor) has finished mounting.
 */
export function waitForSelector(
  selector: string,
  timeoutMs = 5000,
): Promise<boolean> {
  if (document.querySelector(selector)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(true);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, timeoutMs);
  });
}
