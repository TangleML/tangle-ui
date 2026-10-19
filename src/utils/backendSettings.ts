import { API_URL } from "./constants";
import {
  getUseEnv,
  getUserBackendUrl,
  getUseRelativePath,
} from "./localforage";

export async function getBackendSettings() {
  const [useEnv, useRelativePath, userBackendUrl] = await Promise.all([
    getUseEnv(),
    getUseRelativePath(),
    getUserBackendUrl(),
  ]);
  return {
    useEnv: useEnv === true,
    useRelativePath: useRelativePath === true && !API_URL,
    userBackendUrl,
  };
}

export function selectBackendUrl(
  useEnv: boolean,
  useRelativePath: boolean,
  userBackendUrl: string,
): string {
  if (useEnv && API_URL) return API_URL;
  return useRelativePath ? window.location.origin : userBackendUrl;
}
