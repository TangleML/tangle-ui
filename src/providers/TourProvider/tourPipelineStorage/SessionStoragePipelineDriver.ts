import type {
  PipelineFileDescriptor,
  PipelineStorageDriver,
} from "@/services/pipelineStorage/types";

import { SESSION_KEY_PREFIX } from "./constants";

export class SessionStoragePipelineDriver implements PipelineStorageDriver {
  readonly type = "session-storage";
  readonly allowsMoveIn = false;
  readonly allowsMoveOut = false;

  private key(storageKey: string): string {
    return `${SESSION_KEY_PREFIX}${storageKey}`;
  }

  async list(): Promise<PipelineFileDescriptor[]> {
    const descriptors: PipelineFileDescriptor[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const fullKey = sessionStorage.key(i);
      if (fullKey?.startsWith(SESSION_KEY_PREFIX)) {
        descriptors.push({
          storageKey: fullKey.slice(SESSION_KEY_PREFIX.length),
        });
      }
    }
    return descriptors;
  }

  async read(storageKey: string): Promise<string> {
    const content = sessionStorage.getItem(this.key(storageKey));
    if (content === null) {
      throw new Error(
        `Tour pipeline "${storageKey}" not found in sessionStorage`,
      );
    }
    return content;
  }

  async write(storageKey: string, content: string): Promise<void> {
    sessionStorage.setItem(this.key(storageKey), content);
  }

  async delete(storageKey: string): Promise<void> {
    sessionStorage.removeItem(this.key(storageKey));
  }

  async rename(oldStorageKey: string, newStorageKey: string): Promise<void> {
    const content = sessionStorage.getItem(this.key(oldStorageKey));
    if (content === null) {
      throw new Error(
        `Tour pipeline "${oldStorageKey}" not found in sessionStorage`,
      );
    }
    sessionStorage.setItem(this.key(newStorageKey), content);
    sessionStorage.removeItem(this.key(oldStorageKey));
  }

  async hasKey(storageKey: string): Promise<boolean> {
    return sessionStorage.getItem(this.key(storageKey)) !== null;
  }
}
