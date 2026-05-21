/**
 * Lazy skills loader.
 *
 * Fetches `<skillsBaseUrl>/<skillId>/SKILL.md` and caches the content in
 * IndexedDB. The cache is revalidated on each load via an
 * `If-None-Match` request: when the static asset's ETag matches what we
 * already have, the server returns 304 and we serve from IDB; otherwise
 * the new content overwrites the cache. This keeps deploys fresh
 * without a manual cache bust.
 *
 * No skill is bound to any sub-agent yet — this module is the
 * infrastructure for the next iteration where prompts can include
 * skill content.
 */
import { config } from "../config";
import { agentDb } from "../idb/agentDb";

interface SkillFetchResult {
  id: string;
  content: string;
  version: string;
}

async function readCached(id: string): Promise<{
  content: string;
  version: string;
} | null> {
  const cached = await agentDb.skills.get(id);
  if (!cached) return null;
  return { content: cached.content, version: cached.version };
}

async function writeCached(entry: SkillFetchResult): Promise<void> {
  await agentDb.skills.put(entry);
}

async function fetchWithRevalidation(id: string): Promise<SkillFetchResult> {
  const url = `${config.skillsBaseUrl}/${id}/SKILL.md`;
  const cached = await readCached(id);

  const headers: HeadersInit = {};
  if (cached?.version) {
    headers["If-None-Match"] = cached.version;
  }

  const res = await fetch(url, { headers });

  if (res.status === 304 && cached) {
    return { id, content: cached.content, version: cached.version };
  }

  if (!res.ok) {
    if (cached) {
      console.warn(
        `Failed to refresh skill "${id}" (${res.status}); serving cached copy.`,
      );
      return { id, content: cached.content, version: cached.version };
    }
    throw new Error(
      `Failed to fetch skill "${id}" from ${url}: ${res.status} ${res.statusText}`,
    );
  }

  const content = await res.text();
  const version = res.headers.get("ETag") ?? "";
  const entry: SkillFetchResult = { id, content, version };
  await writeCached(entry);
  return entry;
}

const inflight = new Map<string, Promise<SkillFetchResult>>();

/**
 * Returns the SKILL.md content for the given skill id, using the IDB
 * cache when the remote ETag has not changed. Subsequent calls for the
 * same id return a cached result for the lifetime of the worker.
 */
export async function loadSkill(id: string): Promise<string> {
  let pending = inflight.get(id);
  if (!pending) {
    pending = fetchWithRevalidation(id);
    inflight.set(id, pending);
  }
  const result = await pending;
  return result.content;
}
