import { toPortablePipelineSpec } from "@/models/componentSpec/serialization/portablePipelineSpec";
import { isValidComponentSpec } from "@/utils/componentSpec";
import { componentSpecFromYaml, componentSpecToYaml } from "@/utils/yaml";

import type {
  HostErrorCode,
  HostPipelineSummary,
  PipelineStorageHost,
} from "../host/contract";
import { reportStorageAnswered, reportStorageFailed } from "../storageHealth";
import {
  HOST_DRIVER_TYPE,
  type PipelineFileDescriptor,
  type PipelineStorageDriver,
} from "../types";

export interface HostDriverConfig {
  driverType: "host";
}

const UNTITLED_PIPELINE_NAME = "Untitled pipeline";

export class HostStorageError extends Error {
  readonly name = "HostStorageError";

  constructor(
    readonly code: HostErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class HostStorageDriver implements PipelineStorageDriver {
  readonly type = HOST_DRIVER_TYPE;
  readonly allowsMoveIn = false;
  readonly allowsMoveOut = false;
  readonly listingIsAuthoritative = true;

  constructor(private readonly host: PipelineStorageHost) {}

  async list(): Promise<PipelineFileDescriptor[]> {
    const summaries = await this.call(() => this.host.list());
    return summaries.map((summary) => toDescriptor(summary));
  }

  async read(storageKey: string): Promise<string> {
    const pipeline = await this.call(() => this.host.read(storageKey));

    if (!isValidComponentSpec(pipeline.spec)) {
      throw new HostStorageError(
        "unavailable",
        `Pipeline "${storageKey}" came back in a format this editor cannot read.`,
      );
    }

    return componentSpecToYaml(pipeline.spec);
  }

  async write(
    storageKey: string,
    content: string,
  ): Promise<PipelineFileDescriptor> {
    const spec = toPortablePipelineSpec(componentSpecFromYaml(content));
    const summary = await this.call(() => this.host.write(storageKey, spec));
    return toDescriptor(summary);
  }

  async delete(storageKey: string): Promise<void> {
    await this.call(() => this.host.delete(storageKey));
  }

  async hasKey(storageKey: string): Promise<boolean> {
    return this.call(() => this.host.has(storageKey));
  }

  /**
   * Every call to the store passes through here, which makes it the one place
   * that knows whether the store is answering — no separate health check, and
   * nothing to go stale between calls.
   */
  private async call<T>(operation: () => Promise<T>): Promise<T> {
    try {
      const answer = await operation();
      reportStorageAnswered();
      return answer;
    } catch (error) {
      const failure = this.toStorageError(error);
      reportStorageFailed(failure.code);
      throw failure;
    }
  }

  private toStorageError(error: unknown): HostStorageError {
    if (error instanceof HostStorageError) return error;

    const code = readErrorCode(error);
    return new HostStorageError(code, describe(code, this.host.label), {
      cause: error,
    });
  }
}

function toDescriptor(summary: HostPipelineSummary): PipelineFileDescriptor {
  return {
    storageKey: summary.key,
    externalId: summary.externalId,
    displayName: summary.displayName ?? UNTITLED_PIPELINE_NAME,
    contentVersion: summary.contentVersion,
    createdAt: toDate(summary.createdAt),
    modifiedAt: toDate(summary.modifiedAt),
  };
}

function toDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Errors cross a window boundary, where `instanceof` does not survive, so the
 * code is duck-typed off the rejection value and anything unrecognised — an
 * older or newer host vocabulary included — degrades to "unavailable".
 */
function readErrorCode(error: unknown): HostErrorCode {
  if (typeof error !== "object" || error === null) return "unavailable";

  const code: unknown = Reflect.get(error, "code");
  switch (code) {
    case "unauthenticated":
    case "not_found":
    case "rate_limited":
    case "conflict":
      return code;
    default:
      return "unavailable";
  }
}

function describe(code: HostErrorCode, label: string): string {
  switch (code) {
    case "unauthenticated":
      return `Your ${label} session has expired. Reload the page to sign in again.`;
    case "not_found":
      return `This pipeline no longer exists in ${label}.`;
    case "rate_limited":
      return `${label} is busy. Wait a moment before trying again.`;
    case "conflict":
      return `This pipeline changed in ${label} since it was opened. Reload it before saving again.`;
    case "unavailable":
      return `${label} could not be reached. Try again in a moment.`;
  }
}
