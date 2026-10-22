import { parseComponentData } from "@/services/componentService";
import type {
  ComponentFolder,
  ComponentLibrary,
} from "@/types/componentLibrary";
import type { ComponentReference } from "@/utils/componentSpec";
import {
  generateDigest,
  getAllComponentFilesFromList,
} from "@/utils/componentStore";
import { USER_COMPONENTS_LIST_NAME } from "@/utils/constants";
import { getComponentById, getComponentByUrl } from "@/utils/localforage";
import { componentSpecToYaml } from "@/utils/yaml";

export const fetchUserComponents = async (): Promise<ComponentFolder> => {
  try {
    const componentFiles = await getAllComponentFilesFromList(
      USER_COMPONENTS_LIST_NAME,
    );

    const components: ComponentReference[] = [];

    Array.from(componentFiles.entries()).forEach(([_, fileEntry]) => {
      components.push({
        ...fileEntry.componentRef,
        name: fileEntry.name,
        owned: true,
      });
    });

    const userComponentsFolder: ComponentFolder = {
      name: "User Components",
      components,
      folders: [],
      isUserFolder: true,
    };

    return userComponentsFolder;
  } catch (error) {
    console.error("Error fetching user components:", error);
    return {
      name: "User Components",
      components: [],
      folders: [],
      isUserFolder: true,
    };
  }
};

export async function isFavoriteComponent(component: ComponentReference) {
  if (!component.digest) return false;

  const storedComponent = await getComponentById(
    `component-${component.digest}`,
  );

  return storedComponent?.favorited ?? false;
}

export async function populateComponentRefs<
  T extends ComponentLibrary | ComponentFolder,
>(libraryOrFolder: T): Promise<T> {
  async function populateRef(
    ref: ComponentReference,
  ): Promise<ComponentReference> {
    if (ref.text) {
      const parsed = parseComponentData(ref.text);
      const digest = await generateDigest(ref.text);
      return {
        ...ref,
        spec: parsed || ref.spec,
        digest: digest || ref.digest,
      };
    }

    if (ref.url) {
      const stored = await getComponentByUrl(ref.url);
      if (stored && stored.data) {
        const parsed = parseComponentData(stored.data);
        const digest = await generateDigest(stored.data);
        return {
          ...ref,
          spec: parsed || ref.spec,
          digest: digest || ref.digest,
          text: stored.data,
          favorited: stored.favorited || ref.favorited || false,
        };
      }
    }

    if (ref.spec) {
      const text = componentSpecToYaml(ref.spec);
      const digest = await generateDigest(text);
      return { ...ref, text, digest };
    }

    return ref;
  }

  const updatedComponents =
    "components" in libraryOrFolder && Array.isArray(libraryOrFolder.components)
      ? await Promise.all(libraryOrFolder.components.map(populateRef))
      : [];

  const updatedFolders =
    "folders" in libraryOrFolder && Array.isArray(libraryOrFolder.folders)
      ? await Promise.all(
          libraryOrFolder.folders.map((folder) =>
            populateComponentRefs(folder),
          ),
        )
      : [];

  return {
    ...libraryOrFolder,
    ...(updatedComponents.length ? { components: updatedComponents } : {}),
    ...(updatedFolders.length ? { folders: updatedFolders } : {}),
  } as T;
}

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
