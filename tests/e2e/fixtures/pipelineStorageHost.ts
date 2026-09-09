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
  readKeys(): string[];
  setFailMode(mode: HostFailMode): void;
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

      /**
       * Deliberately not persisted: a test asserting that a reload served the
       * pipeline contents from cache needs the count for this page load alone.
       */
      const readKeys: string[] = [];

      let failMode = config.failMode;

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

        if (failMode !== "none") {
          throw Object.assign(new Error(`host is ${failMode}`), {
            code: failMode,
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
          readKeys.push(key);
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
        readKeys: () => [...readKeys],
        setFailMode: (mode) => {
          failMode = mode;
        },
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

/**
 * Puts a pipeline in the browser's own store without going through the UI. The
 * app cannot be asked to make one here: this page has host storage turned on,
 * so there is no local mode to create it in — which is the very situation the
 * migration exists for.
 */
export async function seedLocallyStoredPipeline(
  page: Page,
  name: string,
): Promise<void> {
  await page.evaluate(async (pipelineName) => {
    const FILES = "file_store_user_pipelines";
    const DATA = "digest_to_component_data";
    const SETTINGS = "component_store_settings";
    const STORES = [FILES, DATA, SETTINGS];

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const probe = indexedDB.open("components");
      probe.onerror = () => reject(probe.error);
      probe.onsuccess = () => {
        const opened = probe.result;
        const missing = STORES.filter(
          (store) => !opened.objectStoreNames.contains(store),
        );
        if (missing.length === 0) return resolve(opened);

        const nextVersion = opened.version + 1;
        opened.close();
        const upgrade = indexedDB.open("components", nextVersion);
        upgrade.onupgradeneeded = () => {
          for (const store of missing) upgrade.result.createObjectStore(store);
        };
        upgrade.onerror = () => reject(upgrade.error);
        upgrade.onsuccess = () => resolve(upgrade.result);
      };
    });

    const text = `name: ${pipelineName}\nimplementation:\n  graph:\n    tasks: {}\n`;
    const data = new TextEncoder().encode(text).buffer;
    const hash = await crypto.subtle.digest("SHA-256", data);
    const digest = [...new Uint8Array(hash)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORES, "readwrite");

      transaction.objectStore(DATA).put(data, digest);
      /**
       * Claims the current format so the legacy store's own upgrade does not
       * run over a hand-written entry and reject it as corrupt.
       */
      transaction
        .objectStore(SETTINGS)
        .put(4, "component_list_format_version_user_pipelines");
      transaction.objectStore(FILES).put(
        {
          name: pipelineName,
          data,
          componentRef: {
            text,
            digest,
            spec: {
              name: pipelineName,
              implementation: { graph: { tasks: {} } },
            },
          },
          creationTime: new Date(),
          modificationTime: new Date(),
        },
        pipelineName,
      );

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    database.close();
  }, name);
}

/**
 * Takes the store away, or gives it back, without reloading — the failure that
 * matters is the one that arrives while someone is working.
 */
export async function setHostFailMode(
  page: Page,
  mode: HostFailMode,
): Promise<void> {
  await page.evaluate(
    (value) => window.__TANGLE_TEST_HOST__?.setFailMode(value),
    mode,
  );
}

export async function readHostRecords(page: Page): Promise<HostRecord[]> {
  return page.evaluate(() => window.__TANGLE_TEST_HOST__?.records() ?? []);
}

export async function readHostReadKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__TANGLE_TEST_HOST__?.readKeys() ?? []);
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
