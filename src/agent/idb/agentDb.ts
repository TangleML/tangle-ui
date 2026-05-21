/**
 * IndexedDB schema for the in-browser agent.
 *
 * One table:
 * - skills: SKILL.md content fetched from the configured skills base URL
 *
 * The legacy `vectorStores` table (v1) is dropped in v2 — semantic
 * component / docs search is now handled by the Tangle backend, so the
 * worker no longer caches embeddings locally.
 */
import { Dexie, type EntityTable } from "dexie";

export interface SkillEntry {
  id: string;
  version: string;
  content: string;
}

export const agentDb = new Dexie("tangle_agent") as Dexie & {
  skills: EntityTable<SkillEntry, "id">;
};

agentDb.version(1).stores({
  vectorStores: "key",
  skills: "id",
});

agentDb.version(2).stores({
  vectorStores: null,
  skills: "id",
});
