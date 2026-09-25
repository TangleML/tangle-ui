import { toPortablePipelineSpec } from "@/models/componentSpec/serialization/portablePipelineSpec";
import { isValidComponentSpec } from "@/utils/componentSpec";
import { componentSpecFromYaml, componentSpecToYaml } from "@/utils/yaml";

import { getBackendEndpoint } from "../backendEndpoint";
import { reportStorageAnswered, reportStorageFailed } from "../storageHealth";
import {
  BACKEND_DRIVER_TYPE,
  type PipelineFileDescriptor,
  type PipelineStorageDriver,
  type StorageErrorCode,
} from "../types";

export interface BackendDriverConfig {
  driverType: "backend";
}

const PIPELINES_PATH = "/api/users/me/pipelines";

const LIST_PATH = "/api/users/me/pipelines/all";

const PAGE_SIZE = 100;

const UNTITLED_PIPELINE_NAME = "Untitled pipeline";

export class BackendStorageError extends Error {
  readonly name = "BackendStorageError";

  constructor(
    readonly code: StorageErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

interface StoredPipeline {
  id: string;
  file_path: string;
  pipeline_name?: string | null;
  current_version?: string | null;
  created_at?: string;
  updated_at?: string;
  root_pipeline_task?: { componentRef?: { spec?: unknown } };
}

interface PipelineListPage {
  pipelines?: StoredPipeline[];
  next_page_token?: string | null;
}

/**
 * Pipelines kept by the backend the app is configured against, under the
 * routes below. Nothing here is specific to a deployment: a backend that serves
 * these routes can hold pipelines for this editor.
 */
export class BackendStorageDriver implements PipelineStorageDriver {
  readonly type = BACKEND_DRIVER_TYPE;
  readonly allowsMoveIn = false;
  readonly allowsMoveOut = false;
  readonly listingIsAuthoritative = true;

  async list(): Promise<PipelineFileDescriptor[]> {
    const rows: PipelineFileDescriptor[] = [];
    const seen = new Set<string>();

    let token: string | undefined;
    do {
      const page = await this.request<PipelineListPage>("GET", LIST_PATH, {
        page_size: String(PAGE_SIZE),
        page_token: token,
      });

      for (const row of page.pipelines ?? []) rows.push(toDescriptor(row));

      const next = page.next_page_token ?? undefined;
      /**
       * A token that never advances would loop until the backend rate-limits
       * the app and the pipeline list hangs.
       */
      token = next && !seen.has(next) ? next : undefined;
      if (token) seen.add(token);
    } while (token);

    return rows;
  }

  async read(storageKey: string): Promise<string> {
    const row = await this.request<StoredPipeline>("GET", PIPELINES_PATH, {
      file_path: storageKey,
    });

    const spec = row.root_pipeline_task?.componentRef?.spec;
    if (!isValidComponentSpec(spec)) {
      throw new BackendStorageError(
        "unavailable",
        `Pipeline "${storageKey}" came back in a format this editor cannot read.`,
      );
    }

    return componentSpecToYaml(spec);
  }

  /**
   * An upsert on the caller's key. Renaming is a write of a differently-named
   * spec to the same key: the displayed name is derived from the spec.
   */
  async write(
    storageKey: string,
    content: string,
  ): Promise<PipelineFileDescriptor> {
    const spec = toPortablePipelineSpec(componentSpecFromYaml(content));

    const row = await this.request<StoredPipeline>(
      "PUT",
      PIPELINES_PATH,
      { file_path: storageKey },
      { root_pipeline_task: { componentRef: { spec } } },
    );

    return toDescriptor(row);
  }

  async delete(storageKey: string): Promise<void> {
    await this.request("DELETE", PIPELINES_PATH, { file_path: storageKey });
  }

  /**
   * Filtering the listing answers this without transferring a spec. The filter
   * is a prefix match, so the exact key is confirmed against what comes back.
   */
  async hasKey(storageKey: string): Promise<boolean> {
    const page = await this.request<PipelineListPage>("GET", LIST_PATH, {
      file_path: storageKey,
      page_size: String(PAGE_SIZE),
    });

    return (page.pipelines ?? []).some((row) => row.file_path === storageKey);
  }

  private async request<T>(
    method: string,
    path: string,
    query: Record<string, string | undefined>,
    body?: unknown,
  ): Promise<T> {
    const endpoint = getBackendEndpoint();
    if (!endpoint) {
      throw this.reported(
        new BackendStorageError(
          "unavailable",
          "No backend is configured, so pipelines cannot be read or saved. Set one in Settings.",
        ),
      );
    }

    const url = new URL(path, endpoint);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, value);
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        credentials: "include",
        /**
         * An expired session is answered with a cross-origin redirect, which
         * arrives as an opaque response rather than a status code.
         */
        redirect: "manual",
        headers:
          body === undefined ? {} : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw this.reported(
        new BackendStorageError(
          "unavailable",
          `The backend could not be reached. Try again in a moment.`,
          { cause: error },
        ),
      );
    }

    if (response.type === "opaqueredirect" || response.status === 0) {
      throw this.reported(
        new BackendStorageError(
          "unauthenticated",
          "Your session has expired. Reload the page to sign in again.",
        ),
      );
    }

    const raw = response.status === 204 ? "" : await response.text();
    let payload: unknown = null;
    let parsed = false;
    if (raw) {
      try {
        payload = JSON.parse(raw);
        parsed = true;
      } catch {
        parsed = false;
      }
    }

    /**
     * A non-JSON body means the request never reached the API — most likely a
     * single-page-app fallback answering with the index document.
     */
    if (raw && !parsed) {
      throw this.reported(
        new BackendStorageError(
          "unavailable",
          `${path} did not return JSON (HTTP ${response.status}). This backend is not serving the pipeline API.`,
        ),
      );
    }

    if (!response.ok) {
      throw this.reported(
        new BackendStorageError(
          codeForStatus(response.status),
          describeFailure(payload, response),
        ),
      );
    }

    reportStorageAnswered();
    return payload as T;
  }

  private reported(error: BackendStorageError): BackendStorageError {
    reportStorageFailed(error.code);
    return error;
  }
}

function toDescriptor(row: StoredPipeline): PipelineFileDescriptor {
  return {
    storageKey: row.file_path,
    externalId: row.id,
    displayName: row.pipeline_name || UNTITLED_PIPELINE_NAME,
    /**
     * Deliberately not falling back to a revision counter: read as a content
     * version it would report "unchanged" for an edited pipeline and leave a
     * stale editor open.
     */
    contentVersion: row.current_version || "",
    createdAt: toDate(row.created_at),
    modifiedAt: toDate(row.updated_at),
  };
}

function toDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function codeForStatus(status: number): StorageErrorCode {
  if (status === 401 || status === 403) return "unauthenticated";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  return "unavailable";
}

/**
 * Three error envelopes are in use: `detail` (a string or a validation array),
 * `error`, and `error_message`.
 */
function describeFailure(payload: unknown, response: Response): string {
  if (typeof payload === "object" && payload !== null) {
    const detail: unknown = Reflect.get(payload, "detail");
    if (typeof detail === "string" && detail) return detail;

    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map(describeValidationEntry).join("; ");
    }

    for (const field of ["error", "error_message", "message"]) {
      const value: unknown = Reflect.get(payload, field);
      if (typeof value === "string" && value) return value;
    }
  }

  return `HTTP ${response.status} ${response.statusText}`;
}

function describeValidationEntry(entry: unknown): string {
  if (typeof entry !== "object" || entry === null) return String(entry);

  const message = String(Reflect.get(entry, "msg") ?? "");
  const location: unknown = Reflect.get(entry, "loc");
  const where = Array.isArray(location)
    ? location.filter((part) => part !== "body").join(".")
    : "";

  return where ? `${where}: ${message}` : message;
}
