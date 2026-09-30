/**
 * Type augmentations for the File System Access API.
 * These APIs are available in Chromium-based browsers (Chrome 86+, Edge 86+).
 * @see https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 */

interface FileSystemPermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemDirectoryHandle {
  queryPermission(
    descriptor?: FileSystemPermissionDescriptor,
  ): Promise<PermissionState>;
  requestPermission(
    descriptor?: FileSystemPermissionDescriptor,
  ): Promise<PermissionState>;
  values(): AsyncIterableIterator<
    FileSystemFileHandle | FileSystemDirectoryHandle
  >;
  entries(): AsyncIterableIterator<
    [string, FileSystemFileHandle | FileSystemDirectoryHandle]
  >;
  keys(): AsyncIterableIterator<string>;
}

interface FileSystemHandle {
  kind: "file" | "directory";
  name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission(
    descriptor?: FileSystemPermissionDescriptor,
  ): Promise<PermissionState>;
  requestPermission(
    descriptor?: FileSystemPermissionDescriptor,
  ): Promise<PermissionState>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: "file";
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | BufferSource | Blob): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface ShowDirectoryPickerOptions {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?:
    | FileSystemHandle
    | "desktop"
    | "documents"
    | "downloads"
    | "music"
    | "pictures"
    | "videos";
}

interface Window {
  showDirectoryPicker(
    options?: ShowDirectoryPickerOptions,
  ): Promise<FileSystemDirectoryHandle>;
}

interface FileSystemObserverCallback {
  (records: FileSystemChangeRecord[], observer: FileSystemObserver): void;
}

interface FileSystemChangeRecord {
  changedHandle: FileSystemHandle;
  type:
    | "appeared"
    | "disappeared"
    | "modified"
    | "moved"
    | "errored"
    | "unknown";
  relativePathComponents: string[];
  relativePathMovedFrom?: string[];
  root: FileSystemHandle;
}

declare class FileSystemObserver {
  constructor(callback: FileSystemObserverCallback);
  observe(
    handle: FileSystemHandle,
    options?: { recursive?: boolean },
  ): Promise<void>;
  disconnect(): void;
}
