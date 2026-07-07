interface WaitForSelectorOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export function waitForSelector(
  selector: string,
  { timeoutMs = 5000, signal }: WaitForSelectorOptions = {},
): Promise<boolean> {
  if (document.querySelector(selector)) return Promise.resolve(true);
  if (signal?.aborted) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const disposers: Array<() => void> = [];
    let settled = false;
    const finish = (found: boolean) => {
      if (settled) return;
      settled = true;
      disposers.forEach((dispose) => dispose());
      resolve(found);
    };

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) finish(true);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    disposers.push(() => observer.disconnect());

    const timer = setTimeout(() => finish(false), timeoutMs);
    disposers.push(() => clearTimeout(timer));

    if (signal) {
      const onAbort = () => finish(false);
      signal.addEventListener("abort", onAbort, { once: true });
      disposers.push(() => signal.removeEventListener("abort", onAbort));
    }
  });
}
