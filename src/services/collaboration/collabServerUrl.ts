import { getStorage } from "@/utils/typedStorage";

interface CollabServerUrlStorage {
  collabServerUrl: string;
}

const DEFAULT_COLLAB_SERVER_URL = "ws://localhost:8080";

const storage = getStorage<
  keyof CollabServerUrlStorage,
  CollabServerUrlStorage
>();

function defaultCollabServerUrl(): string {
  const fromEnv = import.meta.env.VITE_COLLAB_URL;
  return typeof fromEnv === "string" && fromEnv.length > 0
    ? fromEnv
    : DEFAULT_COLLAB_SERVER_URL;
}

export function getCollabServerUrl(): string {
  const stored = storage.getItem("collabServerUrl");
  return stored && stored.length > 0 ? stored : defaultCollabServerUrl();
}

export function setCollabServerUrl(url: string): void {
  storage.setItem("collabServerUrl", url.trim());
}
