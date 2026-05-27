import { Dexie, type EntityTable } from "dexie";

export const TANGLE_ML_DOCS_VECTORS_KEY = "tangle-ml-documentation";

/**
 * One persisted vector: the source chunk text, its embedding, and any
 * metadata the producer wants to round-trip (title, url, section, ...).
 * Metadata is `unknown` at the IDB layer because different vector
 * stores carry different metadata shapes; consumers cast to their
 * domain-specific type on read.
 */
export interface PersistedVector {
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface PersistedVectorStore {
  version: number;
  embeddingModel: string;
  vectors: PersistedVector[];
}

export interface VectorStoreEntry {
  key: string;
  embeddingModel: string;
  version: number;
  payload: PersistedVectorStore;
}

export interface SkillEntry {
  id: string;
  version: string;
  content: string;
}

export const agentDb = new Dexie("tangle_agent") as Dexie & {
  vectors: EntityTable<VectorStoreEntry, "key">;
  skills: EntityTable<SkillEntry, "id">;
};

agentDb.version(1).stores({
  vectors: "key",
  skills: "id",
});
