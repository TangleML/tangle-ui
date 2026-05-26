/**
 * Shared IndexedDB-backed storage for the AI assistant's LLM proxy token.
 */
import localforage from "localforage";

const store = localforage.createInstance({
  name: "oasis-app",
  storeName: "settings",
  description: "Store for application settings",
});

const KEY = "aiAssistantProxyToken";

export async function getAiToken(): Promise<string | null> {
  return (await store.getItem<string>(KEY)) ?? null;
}

export async function setAiToken(token: string): Promise<void> {
  await store.setItem(KEY, token);
}
