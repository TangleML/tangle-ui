import type { Page } from "@playwright/test";

type HostFailMode = "none" | "unavailable" | "unauthenticated" | "rate_limited";

interface HostSeedPipeline {
  key: string;
  displayName: string;
  spec: unknown;
}

export interface HostStorageOptions {
  label?: string;
  seed?: HostSeedPipeline[];
  failMode?: HostFailMode;
  latencyMs?: number;
}

interface HostRecord {
  key: string;
  externalId: string;
  displayName: string | null;
  contentVersion: string;
  spec: unknown;
}

interface HostTestState {
  records(): HostRecord[];
}

declare global {
  interface Window {
    __TANGLE_TEST_HOST__?: HostTestState;
  }
}

const DEFAULT_LABEL = "Shared storage";

const STATE_KEY = "__tangle_test_host_state__";

/**
 * Stands in for the page that embeds this app. It has to be installed with
 * `addInitScript` rather than `evaluate`, because storage mode is decided while
 * the app boots and never revisited.
 *
 * Its contents outlive a reload — creating a pipeline navigates with a document
 * load, and a store that forgot everything at that point could not show that
 * the write reached it.
 */
export async function installPipelineStorageHost(
  page: Page,
  options: HostStorageOptions = {},
): Promise<void> {
  await page.addInitScript(
    (config: Required<HostStorageOptions> & { stateKey: string }) => {
      const saved = window.sessionStorage.getItem(config.stateKey);
      const store = new Map<string, HostRecord>(
        saved ? (JSON.parse(saved) as [string, HostRecord][]) : [],
      );
      let revision = store.size;

      if (!saved) {
        for (const seeded of config.seed) {
          revision += 1;
          store.set(seeded.key, {
            key: seeded.key,
            externalId: `external-${revision}`,
            displayName: seeded.displayName,
            contentVersion: `v${revision}`,
            spec: seeded.spec,
          });
        }
      }

      function persist(): void {
        window.sessionStorage.setItem(
          config.stateKey,
          JSON.stringify([...store.entries()]),
        );
      }

      persist();

      async function gate(): Promise<void> {
        if (config.latencyMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, config.latencyMs));
        }

        if (config.failMode !== "none") {
          throw Object.assign(new Error(`host is ${config.failMode}`), {
            code: config.failMode,
          });
        }
      }

      function summaryOf(record: HostRecord) {
        const { spec: _spec, ...summary } = record;
        return summary;
      }

      function nameOf(spec: unknown): string | null {
        if (typeof spec !== "object" || spec === null) return null;
        const name: unknown = Reflect.get(spec, "name");
        return typeof name === "string" ? name : null;
      }

      window.__TANGLE_PIPELINE_STORAGE_HOST__ = {
        version: 1,
        label: config.label,
        async list() {
          await gate();
          return [...store.values()].map(summaryOf);
        },
        async read(key: string) {
          await gate();
          const found = store.get(key);
          if (!found) {
            throw Object.assign(new Error(`no pipeline for ${key}`), {
              code: "not_found",
            });
          }
          return found;
        },
        async write(key: string, spec: unknown) {
          await gate();
          const existing = store.get(key);
          revision += 1;
          const record: HostRecord = {
            key,
            externalId: existing?.externalId ?? `external-${revision}`,
            displayName: nameOf(spec),
            contentVersion: `v${revision}`,
            spec,
          };
          store.set(key, record);
          persist();
          return summaryOf(record);
        },
        async delete(key: string) {
          await gate();
          store.delete(key);
          persist();
        },
        async has(key: string) {
          await gate();
          return store.has(key);
        },
      };

      window.__TANGLE_TEST_HOST__ = {
        records: () => [...store.values()],
      };
    },
    {
      label: options.label ?? DEFAULT_LABEL,
      seed: options.seed ?? [],
      failMode: options.failMode ?? "none",
      latencyMs: options.latencyMs ?? 0,
      stateKey: STATE_KEY,
    } satisfies Required<HostStorageOptions> & { stateKey: string },
  );
}

export async function readHostRecords(page: Page): Promise<HostRecord[]> {
  return page.evaluate(() => window.__TANGLE_TEST_HOST__?.records() ?? []);
}

/**
 * The negative assertion host mode exists for: with a host present, nothing may
 * reach the browser's own pipeline store, whatever the host does.
 */
export async function readLocallyStoredPipelineKeys(
  page: Page,
): Promise<string[]> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase | undefined>((resolve) => {
      const request = indexedDB.open("components");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });

    if (!database) return [];

    const storeName = "file_store_user_pipelines";
    if (!database.objectStoreNames.contains(storeName)) {
      database.close();
      return [];
    }

    const keys = await new Promise<string[]>((resolve) => {
      const request = database
        .transaction(storeName, "readonly")
        .objectStore(storeName)
        .getAllKeys();
      request.onsuccess = () => resolve(request.result.map(String));
      request.onerror = () => resolve([]);
    });

    database.close();
    return keys;
  });
}
