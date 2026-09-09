import type { Page } from "@playwright/test";

type BackendFailMode =
  "none" | "unavailable" | "unauthenticated" | "rate_limited";

interface SeedPipeline {
  key: string;
  displayName: string;
  spec: unknown;
}

export interface BackendStorageOptions {
  seed?: SeedPipeline[];
  failMode?: BackendFailMode;
}

export interface StoredPipeline {
  key: string;
  externalId: string;
  displayName: string | null;
  contentVersion: string;
  spec: unknown;
}

interface BackendStore {
  records: StoredPipeline[];
  readKeys: string[];
  failMode: BackendFailMode;
  revision: number;
}

const PIPELINES_PATH = "**/api/users/me/pipelines**";

const PING_PATH = "**/services/ping";

const STATUS_FOR: Record<Exclude<BackendFailMode, "none">, number> = {
  unavailable: 503,
  unauthenticated: 401,
  rate_limited: 429,
};

const stores = new WeakMap<Page, BackendStore>();

function storeFor(page: Page): BackendStore {
  const store = stores.get(page);
  if (!store) throw new Error("No pipeline backend installed for this page");
  return store;
}

function rowOf(record: StoredPipeline, withSpec: boolean) {
  return {
    id: record.externalId,
    file_path: record.key,
    pipeline_name: record.displayName,
    current_version: record.contentVersion,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    ...(withSpec
      ? { root_pipeline_task: { componentRef: { spec: record.spec } } }
      : {}),
  };
}

function nameOf(spec: unknown): string | null {
  if (typeof spec !== "object" || spec === null) return null;
  const name: unknown = Reflect.get(spec, "name");
  return typeof name === "string" ? name : null;
}

/**
 * Serves the pipeline routes the storage driver calls. The store lives in the
 * test process rather than the page, so it survives a reload the way a real
 * backend does — creating a pipeline navigates with a document load, and a
 * store that forgot everything there could not show that the write landed.
 */
export async function installPipelineStorageBackend(
  page: Page,
  options: BackendStorageOptions = {},
): Promise<void> {
  const seed = options.seed ?? [];

  stores.set(page, {
    records: seed.map((entry, index) => ({
      key: entry.key,
      externalId: `external-${index + 1}`,
      displayName: entry.displayName,
      contentVersion: `v${index + 1}`,
      spec: entry.spec,
    })),
    readKeys: [],
    failMode: options.failMode ?? "none",
    revision: seed.length,
  });

  /**
   * One deployment serves both, so the health check answers exactly when the
   * pipeline routes do.
   */
  await page.route(PING_PATH, (route) => {
    const store = storeFor(page);
    return store.failMode === "none"
      ? route.fulfill({ status: 200, body: "ok" })
      : route.fulfill({ status: STATUS_FOR[store.failMode], body: "down" });
  });

  await page.route(PIPELINES_PATH, async (route) => {
    const store = storeFor(page);

    if (store.failMode !== "none") {
      return route.fulfill({
        status: STATUS_FOR[store.failMode],
        contentType: "application/json",
        body: JSON.stringify({ detail: `backend is ${store.failMode}` }),
      });
    }

    const url = new URL(route.request().url());
    const key = url.searchParams.get("file_path") ?? "";
    const isListing = url.pathname.endsWith("/all");
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (isListing) {
      const matched = store.records.filter((row) => !key || row.key === key);
      return json({
        pipelines: matched.map((row) => rowOf(row, false)),
        next_page_token: null,
      });
    }

    switch (route.request().method()) {
      case "PUT": {
        const sent = route.request().postDataJSON() as {
          root_pipeline_task: { componentRef: { spec: unknown } };
        };
        const spec = sent.root_pipeline_task.componentRef.spec;
        const existing = store.records.find((row) => row.key === key);
        store.revision += 1;

        const written: StoredPipeline = {
          key,
          externalId: existing?.externalId ?? `external-${store.revision}`,
          displayName: nameOf(spec),
          contentVersion: `v${store.revision}`,
          spec,
        };

        // Keeps its place in the listing, as a store keyed by id would.
        store.records = existing
          ? store.records.map((row) => (row.key === key ? written : row))
          : [...store.records, written];
        return json(rowOf(written, true));
      }
      case "DELETE":
        store.records = store.records.filter((row) => row.key !== key);
        return route.fulfill({ status: 204, body: "" });
      default: {
        store.readKeys.push(key);
        const found = store.records.find((row) => row.key === key);
        if (!found) return json({ detail: `no pipeline for ${key}` }, 404);
        return json(rowOf(found, true));
      }
    }
  });
}

/**
 * Takes the backend away, or gives it back, without reloading — the failure
 * that matters is the one that arrives while someone is working.
 */
export function setBackendFailMode(page: Page, mode: BackendFailMode): void {
  storeFor(page).failMode = mode;
}

export function readBackendRecords(page: Page): StoredPipeline[] {
  return [...storeFor(page).records];
}

/**
 * Which pipelines were fetched in full. Reset per install rather than per page
 * load, so a test can assert that a revisit read none of them.
 */
export function readBackendReadKeys(page: Page): string[] {
  return [...storeFor(page).readKeys];
}

export function forgetBackendReadKeys(page: Page): void {
  storeFor(page).readKeys = [];
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

    /**
     * The app copies browser-stored pipelines into the host once, on whichever
     * page it first opens, and records that it has. Seeding has to go through a
     * running page, which is necessarily after that — so the record goes, which
     * puts the app back where a user with pipelines and a new host starts.
     */
    const registry = await new Promise<IDBDatabase | undefined>((resolve) => {
      const request = indexedDB.open("tangle_pipelines");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });

    if (registry?.objectStoreNames.contains("host_migration")) {
      const settled = () =>
        new Promise<boolean>((resolve) => {
          const request = registry
            .transaction("host_migration", "readonly")
            .objectStore("host_migration")
            .get("v1");
          request.onsuccess = () => {
            const record = request.result as
              { completedAt?: number; dismissedAt?: number } | undefined;
            resolve(
              record?.completedAt !== undefined ||
                record?.dismissedAt !== undefined,
            );
          };
          request.onerror = () => resolve(false);
        });

      /**
       * The copy this page load already started would otherwise write its own
       * record back over the cleared one, and the next load would read it as
       * done.
       */
      for (let attempt = 0; attempt < 50 && !(await settled()); attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await new Promise<void>((resolve) => {
        const transaction = registry.transaction("host_migration", "readwrite");
        transaction.objectStore("host_migration").clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      });
    }

    registry?.close();
  }, name);
}

/**
 * The negative assertion backend storage exists for: with the beta on, nothing
 * may reach the browser's own pipeline store, whatever the backend does.
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
