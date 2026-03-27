import type {
  DriverPermissions,
  PipelineFileDescriptor,
  PipelineStorageDriver,
} from "../types";

export interface LocalFileSystemDriverConfig {
  driverType: "local-fs";
  handle: FileSystemDirectoryHandle;
}

const PIPELINE_YAML_PATTERN = /\.pipeline\.component\.ya?ml$/i;
const PIPELINE_SUFFIX = ".pipeline.component.yaml";

function toFileName(storageKey: string): string {
  if (PIPELINE_YAML_PATTERN.test(storageKey)) return storageKey;
  return storageKey + PIPELINE_SUFFIX;
}

class LocalFsPermissions implements DriverPermissions {
  constructor(private readonly handle: FileSystemDirectoryHandle) {}

  async check() {
    return this.handle.queryPermission({ mode: "readwrite" });
  }

  async request() {
    const status = await this.handle.requestPermission({
      mode: "readwrite",
    });
    return status === "granted";
  }
}

export class LocalFileSystemDriver implements PipelineStorageDriver {
  readonly type = "local-fs";
  readonly allowsMoveIn = false;
  readonly allowsMoveOut = false;
  readonly permissions: DriverPermissions;

  constructor(private readonly dirHandle: FileSystemDirectoryHandle) {
    this.permissions = new LocalFsPermissions(dirHandle);
  }

  async list(): Promise<PipelineFileDescriptor[]> {
    const descriptors: PipelineFileDescriptor[] = [];

    for await (const entry of this.dirHandle.values()) {
      if (entry.kind !== "file") continue;
      if (!PIPELINE_YAML_PATTERN.test(entry.name)) continue;

      const fileHandle = entry as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      descriptors.push({
        storageKey: entry.name,
        modifiedAt: new Date(file.lastModified),
      });
    }

    return descriptors.sort((a, b) => {
      const aTime = a.modifiedAt?.getTime() ?? 0;
      const bTime = b.modifiedAt?.getTime() ?? 0;
      return bTime - aTime;
    });
  }

  async read(storageKey: string): Promise<string> {
    const fileName = toFileName(storageKey);
    const fileHandle = await this.dirHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file.text();
  }

  async write(storageKey: string, content: string): Promise<void> {
    const fileName = toFileName(storageKey);
    const fileHandle = await this.dirHandle.getFileHandle(fileName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async rename(oldStorageKey: string, newStorageKey: string): Promise<void> {
    const oldFileName = toFileName(oldStorageKey);
    const newFileName = toFileName(newStorageKey);

    const oldHandle = await this.dirHandle.getFileHandle(oldFileName);
    const file = await oldHandle.getFile();
    const content = await file.text();

    const newHandle = await this.dirHandle.getFileHandle(newFileName, {
      create: true,
    });
    const writable = await newHandle.createWritable();
    await writable.write(content);
    await writable.close();

    await this.dirHandle.removeEntry(oldFileName);
  }

  async delete(storageKey: string): Promise<void> {
    const fileName = toFileName(storageKey);
    await this.dirHandle.removeEntry(fileName);
  }

  async hasKey(storageKey: string): Promise<boolean> {
    try {
      const fileName = toFileName(storageKey);
      await this.dirHandle.getFileHandle(fileName);
      return true;
    } catch {
      return false;
    }
  }
}
