import localforage from "localforage";

import type { ComponentReference } from "./componentSpec";
import { USER_COMPONENTS_LIST_NAME } from "./constants";

const FILE_STORE_DB_TABLE_NAME_PREFIX = "file_store_";
// Define the Component interface
interface Component {
  id: string;
  url: string;
  data: string; // Component data as string
  favorited?: boolean; // Optional field for favorited status
  createdAt: number;
  updatedAt: number;
}

export interface UserComponent {
  componentRef: ComponentReference;
  creationTime: Date;
  modificationTime: Date;
  data: ArrayBuffer;
  name: string;
}

// Setup localforage instances for different stores
const componentStore = localforage.createInstance({
  name: "components",
  storeName: "components",
  description: "Store for component data",
});

const componentUrlStore = localforage.createInstance({
  name: "components",
  storeName: "componentUrls",
  description: "Store for tracking existing component URLs",
});

const userComponentStore = localforage.createInstance({
  name: "components",
  storeName: FILE_STORE_DB_TABLE_NAME_PREFIX + USER_COMPONENTS_LIST_NAME,
  description: "Store for user component data",
});

const settingsStore = localforage.createInstance({
  name: "oasis-app",
  storeName: "settings",
  description: "Store for application settings",
});

// Function to save a component
export async function saveComponent(component: Component): Promise<Component> {
  const now = Date.now();
  const updatedComponent = {
    ...component,
    updatedAt: now,
    createdAt: component.createdAt || now,
  };

  await componentStore.setItem(component.id, updatedComponent);

  if (component.url.trim() !== "") {
    await componentUrlStore.setItem(component.url, component.id);
  }

  return updatedComponent;
}

// Function to check if a component exists by URL
export async function componentExistsByUrl(url: string): Promise<boolean> {
  const componentId = await componentUrlStore.getItem<string>(url);
  return componentId !== null;
}

// Function to get a component by ID
export async function getComponentById(id: string): Promise<Component | null> {
  return componentStore.getItem<Component>(id);
}

export async function iterateOverAllComponents(
  visitorFn: (component: Component) => Promise<void>,
): Promise<void> {
  const promises: Promise<void>[] = [];
  await componentStore.iterate<Component, void>((component) => {
    promises.push(visitorFn(component));
  });
  await Promise.all(promises);
}

// Function to get a component by URL
export async function getComponentByUrl(
  url: string,
): Promise<Component | null> {
  const componentId = await componentUrlStore.getItem<string>(url);
  if (!componentId) return null;

  return getComponentById(componentId);
}

// Function to fetch all components
export async function getAllUserComponents(): Promise<UserComponent[]> {
  const userComponents: UserComponent[] = [];

  await userComponentStore.iterate<UserComponent, void>((value) => {
    userComponents.push(value);
  });

  return userComponents;
}

export async function getUserComponentByName(
  name: string,
): Promise<UserComponent | null> {
  return await userComponentStore.getItem<UserComponent>(name);
}

// App Settings
export const getUserBackendUrl = async () => {
  return (await settingsStore.getItem<string>("userBackendUrl")) ?? "";
};
export const setUserBackendUrl = (url: string) =>
  settingsStore.setItem("userBackendUrl", url);

export const getUseEnv = async () => {
  return (await settingsStore.getItem<boolean>("useEnv")) ?? true;
};
export const setUseEnv = (flag: boolean) =>
  settingsStore.setItem("useEnv", flag);

export const getUseRelativePath = async () => {
  return (await settingsStore.getItem<boolean>("useRelativePath")) ?? true;
};

export const setUseRelativePath = (flag: boolean) =>
  settingsStore.setItem("useRelativePath", flag);
