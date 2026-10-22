import { normalizeBackendUrl } from "./backendIdentity";
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
  return normalizeBackendUrl(
    useEnv && API_URL
      ? API_URL
      : useRelativePath
        ? window.location.origin
        : userBackendUrl,
  );
}
