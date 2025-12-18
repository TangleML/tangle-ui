import localForage from "localforage";

import type { DownloadDataType } from "./cache";
import { downloadDataWithCache } from "./cache";
import type { ComponentReference, ComponentSpec } from "./componentSpec";
import { getIdOrTitleFromPath } from "./URL";
import { componentSpecFromYaml, componentSpecToYaml } from "./yaml";

// IndexedDB: DB and table names
const DB_NAME = "components";
const DIGEST_TO_DATA_DB_TABLE_NAME = "digest_to_component_data";
const DIGEST_TO_COMPONENT_SPEC_DB_TABLE_NAME = "digest_to_component_spec";
const DIGEST_TO_COMPONENT_NAME_DB_TABLE_NAME = "digest_to_component_name";

const COMPONENT_REF_LISTS_DB_TABLE_NAME = "component_ref_lists";
const COMPONENT_STORE_SETTINGS_DB_TABLE_NAME = "component_store_settings";
const FILE_STORE_DB_TABLE_NAME_PREFIX = "file_store_";

export interface ComponentReferenceWithSpec extends ComponentReference {
  spec: ComponentSpec;
  digest: string;
  // If ComponentReference has digest it probably should have text as well
  text: string;
}

interface ComponentReferenceWithSpecPlusData {
  componentRef: ComponentReferenceWithSpec;
  data: ArrayBuffer;
}

export const generateDigest = async (data: string | ArrayBuffer) => {
  const dataBytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
};

const storeComponentSpec = async (
  digest: string,
  componentSpec: ComponentSpec,
) => {
  const digestToComponentSpecDb = localForage.createInstance({
    name: DB_NAME,
    storeName: DIGEST_TO_COMPONENT_SPEC_DB_TABLE_NAME,
  });
  const digestToComponentNameDb = localForage.createInstance({
    name: DB_NAME,
    storeName: DIGEST_TO_COMPONENT_NAME_DB_TABLE_NAME,
  });
  await digestToComponentSpecDb.setItem(digest, componentSpec);
  if (componentSpec.name !== undefined) {
    await digestToComponentNameDb.setItem(digest, componentSpec.name);
  }
};

export const loadComponentAsRefFromText = async (
  componentText: string | ArrayBuffer,
): Promise<ComponentReferenceWithSpec> => {
  const componentString =
    typeof componentText === "string"
      ? componentText
      : new TextDecoder().decode(componentText);
  const componentBytes =
    typeof componentText === "string"
      ? new TextEncoder().encode(componentText)
      : componentText;

  const componentSpec = componentSpecFromYaml(componentString);

  const digest = await generateDigest(componentBytes as ArrayBuffer);
  const componentRef: ComponentReferenceWithSpec = {
    spec: componentSpec,
    digest: digest,
    text: componentString,
  };
  return componentRef;
};

const loadComponentFromUrlAsRef = async (
  url: string,
  downloadData: DownloadDataType = downloadDataWithCache,
): Promise<ComponentReferenceWithSpec> => {
  const componentRef = await downloadData(url, loadComponentAsRefFromText);
  componentRef.url = url;
  return componentRef;
};

export const preloadComponentReferences = async (
  componentSpec: ComponentSpec,
  downloadData: DownloadDataType = downloadDataWithCache,
  componentMap?: Map<string, ComponentSpec>,
) => {
  // This map is needed to improve efficiency and handle recursive components.
  if (componentMap === undefined) {
    componentMap = new Map<string, ComponentSpec>();
  }
  if ("graph" in componentSpec.implementation) {
    for (const taskSpec of Object.values(
      componentSpec.implementation.graph.tasks,
    )) {
      const componentUrl = taskSpec.componentRef.url;
      let taskComponentSpec = taskSpec.componentRef.spec;

      if (taskComponentSpec === undefined) {
        if (taskSpec.componentRef.text !== undefined) {
          const taskComponentRef = await loadComponentAsRefFromText(
            taskSpec.componentRef.text,
          );
          taskComponentSpec = taskComponentRef.spec;
        } else if (componentUrl !== undefined) {
          taskComponentSpec = componentMap.get(componentUrl);

          if (taskComponentSpec === undefined) {
            const taskComponentRef = await loadComponentFromUrlAsRef(
              componentUrl,
              downloadData,
            );
            taskComponentSpec = taskComponentRef.spec;
            componentMap.set(componentUrl, taskComponentSpec);
          }
        }

        if (taskComponentSpec === undefined) {
          // TODO: Print task name here
          console.error(
            "Could not get component spec for task: ",
            taskSpec.componentRef,
          );
        } else {
          taskSpec.componentRef.spec = taskComponentSpec;
          await preloadComponentReferences(
            taskSpec.componentRef.spec,
            downloadData,
            componentMap,
          );
        }
      }
    }
  }
  return componentSpec;
};

export const fullyLoadComponentRefFromUrl = async (
  url: string,
  downloadData: DownloadDataType = downloadDataWithCache,
): Promise<ComponentReferenceWithSpec> => {
  const componentRef = await loadComponentFromUrlAsRef(url, downloadData);
  const componentSpec = await preloadComponentReferences(
    componentRef.spec,
    downloadData,
  );
  const newComponentRef: ComponentReferenceWithSpec = {
    ...componentRef,
    spec: componentSpec,
  };
  return newComponentRef;
};

const storeComponentText = async (componentText: string | ArrayBuffer) => {
  const componentBytes =
    typeof componentText === "string"
      ? new TextEncoder().encode(componentText)
      : componentText;
  const componentRef = await loadComponentAsRefFromText(componentText);
  const digestToComponentTextDb = localForage.createInstance({
    name: DB_NAME,
    storeName: DIGEST_TO_DATA_DB_TABLE_NAME,
  });
  await digestToComponentTextDb.setItem(componentRef.digest, componentBytes);
  await storeComponentSpec(componentRef.digest, componentRef.spec);

  return componentRef;
};

interface ComponentFileEntryV2 {
  componentRef: ComponentReferenceWithSpec;
}

interface FileEntry {
  name: string;
  creationTime: Date;
  modificationTime: Date;
  data: ArrayBuffer;
}

interface ComponentFileEntryV3
  extends FileEntry, ComponentReferenceWithSpecPlusData {}

export type ComponentFileEntry = ComponentFileEntryV3;

const makeNameUniqueByAddingIndex = (
  name: string,
  existingNames: Set<string>,
): string => {
  let finalName = name;
  let index = 1;
  while (existingNames.has(finalName)) {
    index++;
    finalName = name + " " + index.toString();
  }
  return finalName;
};

const writeComponentRefToFile = async (
  listName: string,
  fileName: string,
  componentRef: ComponentReferenceWithSpec,
) => {
  await upgradeSingleComponentListDb(listName);
  const tableName = FILE_STORE_DB_TABLE_NAME_PREFIX + listName;
  const componentListDb = localForage.createInstance({
    name: DB_NAME,
    storeName: tableName,
  });
  const existingFile =
    await componentListDb.getItem<ComponentFileEntry>(fileName);
  const currentTime = new Date();
  const componentData = new TextEncoder().encode(componentRef.text).buffer;
  let fileEntry: ComponentFileEntry;
  if (existingFile === null) {
    fileEntry = {
      componentRef: componentRef,
      name: fileName,
      creationTime: currentTime,
      modificationTime: currentTime,
      data: componentData,
    };
  } else {
    fileEntry = {
      ...existingFile,
      name: fileName,
      modificationTime: currentTime,
      data: componentData,
      componentRef: componentRef,
    };
  }
  await componentListDb.setItem(fileName, fileEntry);
  return fileEntry;
};

export const updateComponentRefInList = async (
  listName: string,
  componentRef: ComponentReferenceWithSpec,
  fileName: string,
) => {
  await upgradeSingleComponentListDb(listName);
  const tableName = FILE_STORE_DB_TABLE_NAME_PREFIX + listName;
  const componentListDb = localForage.createInstance({
    name: DB_NAME,
    storeName: tableName,
  });
  const existingFile =
    await componentListDb.getItem<ComponentFileEntry>(fileName);
  if (existingFile === null) {
    throw new Error(
      `Cannot update component "${fileName}" in list "${listName}" because it does not exist.`,
    );
  }
  return writeComponentRefToFile(listName, fileName, componentRef);
};

export const writeComponentToFileListFromText = async (
  listName: string,
  fileName: string,
  componentText: string | ArrayBuffer,
) => {
  const componentRef = await storeComponentText(componentText);
  return writeComponentRefToFile(listName, fileName, componentRef);
};

export const renameComponentFileInList = async (
  listName: string,
  oldFileName: string,
  newFileName: string,
  pathname?: string,
) => {
  await upgradeSingleComponentListDb(listName);
  const tableName = FILE_STORE_DB_TABLE_NAME_PREFIX + listName;
  const componentListDb = localForage.createInstance({
    name: DB_NAME,
    storeName: tableName,
  });

  // Check if the old file exists
  let fileEntry =
    await componentListDb.getItem<ComponentFileEntry>(oldFileName);
  if (!fileEntry) {
    // If the old file does not exist and a pathanme is provided, check the url for a filename
    if (pathname) {
      const { title } = getIdOrTitleFromPath(pathname);
      if (title) {
        fileEntry = await componentListDb.getItem<ComponentFileEntry>(title);
      }
      if (!fileEntry) {
        throw new Error(
          `Backup file "${title}" does not exist in list "${listName}".`,
        );
      }
    } else {
      throw new Error(
        `File "${oldFileName}" does not exist in list "${listName}".`,
      );
    }
  }

  // Check if the new file name is already taken
  const existingNewFile =
    await componentListDb.getItem<ComponentFileEntry>(newFileName);
  if (existingNewFile) {
    throw new Error(
      `File "${newFileName}" already exists in list "${listName}".`,
    );
  }

  fileEntry.componentRef.spec.name = newFileName;

  // Update the file entry's name
  const updatedFileEntry = { ...fileEntry, name: newFileName };

  // Remove the old entry and add the new one
  await componentListDb.removeItem(oldFileName);
  await componentListDb.setItem(newFileName, updatedFileEntry);

  return updatedFileEntry;
};

export const getAllComponentFilesFromList = async (listName: string) => {
  await upgradeSingleComponentListDb(listName);
  const tableName = FILE_STORE_DB_TABLE_NAME_PREFIX + listName;
  const componentListDb = localForage.createInstance({
    name: DB_NAME,
    storeName: tableName,
  });
  const componentFiles = new Map<string, ComponentFileEntry>();
  await componentListDb.iterate<ComponentFileEntry, void>(
    (fileEntry, fileName) => {
      fileEntry.creationTime = new Date(fileEntry.creationTime);
      fileEntry.modificationTime = new Date(fileEntry.modificationTime);
      componentFiles.set(fileName, fileEntry);
    },
  );
  return componentFiles;
};

export const getComponentFileFromList = async (
  listName: string,
  fileName: string,
) => {
  await upgradeSingleComponentListDb(listName);
  const tableName = FILE_STORE_DB_TABLE_NAME_PREFIX + listName;
  const componentListDb = localForage.createInstance({
    name: DB_NAME,
    storeName: tableName,
  });
  return componentListDb.getItem<ComponentFileEntry>(fileName);
};

export const deleteComponentFileFromList = async (
  listName: string,
  fileName: string,
) => {
  await upgradeSingleComponentListDb(listName);
  const tableName = FILE_STORE_DB_TABLE_NAME_PREFIX + listName;
  const componentListDb = localForage.createInstance({
    name: DB_NAME,
    storeName: tableName,
  });

  return componentListDb.removeItem(fileName);
};

// TODO: Remove the upgrade code in several weeks.
const upgradeSingleComponentListDb = async (listName: string) => {
  const componentListVersionKey = "component_list_format_version_" + listName;
  const componentStoreSettingsDb = localForage.createInstance({
    name: DB_NAME,
    storeName: COMPONENT_STORE_SETTINGS_DB_TABLE_NAME,
  });
  const componentListTableName = FILE_STORE_DB_TABLE_NAME_PREFIX + listName;
  const componentListDb = localForage.createInstance({
    name: DB_NAME,
    storeName: componentListTableName,
  });
  let listFormatVersion =
    (await componentStoreSettingsDb.getItem<number>(componentListVersionKey)) ??
    1;
  if (![1, 2, 3, 4].includes(listFormatVersion)) {
    throw Error(
      `upgradeComponentListDb: Unknown component list version "${listFormatVersion}" for the list ${listName}`,
    );
  }
  if (listFormatVersion === 1) {
    console.log(`componentStore: Upgrading the component list DB ${listName}`);
    const componentRefListsDb = localForage.createInstance({
      name: DB_NAME,
      storeName: COMPONENT_REF_LISTS_DB_TABLE_NAME,
    });
    const componentRefList: ComponentReferenceWithSpec[] =
      (await componentRefListsDb.getItem(listName)) ?? [];

    const existingNames = new Set<string>();
    const emptyNameReplacement =
      listName === "user_pipelines" ? "Pipeline" : "Component";
    for (const componentRef of componentRefList) {
      const fileName = componentRef.spec.name ?? emptyNameReplacement;
      const uniqueFileName = makeNameUniqueByAddingIndex(
        fileName,
        existingNames,
      );
      const fileEntry: ComponentFileEntryV2 = {
        componentRef: componentRef,
      };
      await componentListDb.setItem(uniqueFileName, fileEntry);
      existingNames.add(uniqueFileName);
    }
    await componentStoreSettingsDb.setItem(componentListVersionKey, 2);
    listFormatVersion = 2;
    console.log(
      `componentStore: Upgraded the component list DB ${listName} to version ${listFormatVersion}`,
    );
  }
  if (listFormatVersion === 2) {
    const digestToDataDb = localForage.createInstance({
      name: DB_NAME,
      storeName: DIGEST_TO_DATA_DB_TABLE_NAME,
    });
    const fileNames = await componentListDb.keys();
    for (const fileName of fileNames) {
      const fileEntry =
        await componentListDb.getItem<ComponentFileEntryV2>(fileName);
      if (fileEntry === null) {
        throw Error(`File "${fileName}" has disappeared during upgrade`);
      }
      const componentRef = fileEntry.componentRef;
      let data = await digestToDataDb.getItem<ArrayBuffer>(
        fileEntry.componentRef.digest,
      );
      if (data === null) {
        console.error(
          `Db is corrupted: Could not find data for file "${fileName}" with digest ${fileEntry.componentRef.digest}.`,
        );
        const componentText = componentSpecToYaml(fileEntry.componentRef.spec);
        const encodedData = new TextEncoder().encode(componentText);
        data = encodedData.buffer;
        const newDigest = await generateDigest(data);
        componentRef.digest = newDigest;
        console.warn(
          `The component "${fileName}" was re-serialized. Old digest: ${fileEntry.componentRef.digest}. New digest ${newDigest}.`,
        );
        // This case should not happen. Let's throw error for now.
        throw Error(
          `Db is corrupted: Could not find data for file "${fileName}" with digest ${fileEntry.componentRef.digest}.`,
        );
      }
      const currentTime = new Date();
      const newFileEntry: ComponentFileEntryV3 = {
        name: fileName,
        creationTime: currentTime,
        modificationTime: currentTime,
        data: data,
        componentRef: componentRef,
      };
      await componentListDb.setItem(fileName, newFileEntry);
    }
    listFormatVersion = 3;
    await componentStoreSettingsDb.setItem(
      componentListVersionKey,
      listFormatVersion,
    );
    console.log(
      `componentStore: Upgraded the component list DB ${listName} to version ${listFormatVersion}`,
    );
  }
  if (listFormatVersion === 3) {
    // Upgrading the DB to backfill entry.componentRef.text from entry.data
    const fileNames = await componentListDb.keys();
    for (const fileName of fileNames) {
      const fileEntry =
        await componentListDb.getItem<ComponentFileEntryV3>(fileName);
      if (fileEntry === null) {
        throw Error(`File "${fileName}" has disappeared during upgrade`);
      }
      if (!fileEntry.componentRef.text) {
        fileEntry.componentRef.text = new TextDecoder().decode(fileEntry.data);
      }
      await componentListDb.setItem(fileName, fileEntry);
    }
    listFormatVersion = 4;
    await componentStoreSettingsDb.setItem(
      componentListVersionKey,
      listFormatVersion,
    );
    console.log(
      `componentStore: Upgraded the component list DB ${listName} to version ${listFormatVersion}`,
    );
  }
};
