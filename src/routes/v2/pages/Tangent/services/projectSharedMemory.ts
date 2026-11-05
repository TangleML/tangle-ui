import type { HostResourceInput, MemoryBinding } from "@tangent/embed-react";

export const PROJECT_MOUNT_NAME = "project";
export const PROJECT_NOTES_ROOT = `${PROJECT_MOUNT_NAME}/NOTES`;
const PROJECT_PI_MEMORY_ROOT = `${PROJECT_MOUNT_NAME}/pi-memory`;

interface ProjectSharedMemorySeed {
  resource: Extract<HostResourceInput, { kind: "mount" }>;
  memory: MemoryBinding;
}

/**
 * The mount and the binding are returned together because neither works alone:
 * the binding's roots resolve through the mount's symlink, so without it the
 * server rejects them, and the mount without the binding leaves each session's
 * memory private to it.
 */
export function projectSharedMemorySeed(
  folderId: string,
): ProjectSharedMemorySeed {
  return {
    resource: { kind: "mount", folderId, mountName: PROJECT_MOUNT_NAME },
    memory: {
      kind: "composite",
      children: [
        { kind: "simple-md", root: PROJECT_NOTES_ROOT },
        { kind: "pi-memory", root: PROJECT_PI_MEMORY_ROOT },
      ],
    },
  };
}
