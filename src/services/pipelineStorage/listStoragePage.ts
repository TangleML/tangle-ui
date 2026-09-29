import type {
  PipelineFileDescriptor,
  PipelinePageOptions,
  PipelineStorageDriver,
  PipelineStoragePage,
} from "./types";

export async function listStoragePage<T extends PipelineFileDescriptor>(
  driver: PipelineStorageDriver<T>,
  options: PipelinePageOptions = {},
): Promise<PipelineStoragePage<T>> {
  options.signal?.throwIfAborted();
  if (driver.listPage) return driver.listPage(options);

  const pageSize = options.pageSize ?? 10;
  const offset =
    options.pageToken === undefined ? 0 : Number(options.pageToken);
  if (
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    (options.pageToken !== undefined && String(offset) !== options.pageToken)
  )
    throw new Error("Invalid pipeline page.");

  const files = await driver.list();
  options.signal?.throwIfAborted();
  const next = offset + pageSize;
  return {
    files: files.slice(offset, next),
    totalCount: files.length,
    nextPageToken: next < files.length ? String(next) : undefined,
  };
}
