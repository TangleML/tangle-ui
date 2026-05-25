export function computeAssetsBase(metaUrl: string, isDev: boolean): string {
  const here = new URL(metaUrl);
  return isDev ? new URL("/", here).href : new URL("..", here).href;
}

export const ASSETS_BASE = computeAssetsBase(
  import.meta.url,
  Boolean(import.meta.env.DEV),
);

export function publicAsset(path: string): string {
  return new URL(path, ASSETS_BASE).href;
}
