import type {
  ComponentFolder,
  ComponentLibrary,
} from "@/types/componentLibrary";
import type {
  ComponentReference,
  GraphSpec,
  TaskSpec,
} from "@/utils/componentSpec";

export const fetchUsedComponents = (graphSpec: GraphSpec): ComponentFolder => {
  if (!graphSpec || !graphSpec.tasks || typeof graphSpec.tasks !== "object") {
    return {
      name: "Used in Pipeline",
      components: [],
      folders: [],
      isUserFolder: false,
    };
  }

  const usedComponentsMap = new Map<string, ComponentReference>();

  Object.values(graphSpec.tasks).forEach((task: TaskSpec) => {
    const key = task.componentRef.digest;
    if (key && !usedComponentsMap.has(key)) {
      usedComponentsMap.set(key, {
        ...task.componentRef,
      });
    }
  });

  return {
    name: "Used in Pipeline",
    components: Array.from(usedComponentsMap.values()),
    folders: [],
    isUserFolder: false,
  };
};

export function flattenFolders(
  folder: ComponentFolder | ComponentLibrary,
): ComponentReference[] {
  let components: ComponentReference[] = [];
  if ("components" in folder && folder.components)
    components = components.concat(folder.components);
  if (folder.folders) {
    folder.folders.forEach((f) => {
      components = components.concat(flattenFolders(f));
    });
  }
  return components;
}

export const filterToUniqueByDigest = (components: ComponentReference[]) => {
  const seenDigests = new Set<string>();
  return components.filter((c) => {
    if (!c.digest) return true;
    if (seenDigests.has(c.digest)) return false;
    seenDigests.add(c.digest);
    return true;
  });
};
