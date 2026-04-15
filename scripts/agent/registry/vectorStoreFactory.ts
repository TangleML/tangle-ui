/**
 * Factory for creating, loading, and saving LangChain MemoryVectorStore instances
 * with JSON file persistence. Replaces the hand-rolled store.ts / docsStore.ts.
 */
import { Document } from "@langchain/core/documents";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { readFile, writeFile } from "fs/promises";

import { createProxyEmbeddings } from "../config";

interface PersistedVector {
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

interface PersistedStoreData {
  version: number;
  embeddingModel: string;
  vectors: PersistedVector[];
}

const STORE_VERSION = 2;

export async function createVectorStore(
  documents: Document[],
): Promise<MemoryVectorStore> {
  return MemoryVectorStore.fromDocuments(documents, createProxyEmbeddings());
}

export async function loadVectorStore(
  filePath: string,
  expectedModel: string,
): Promise<MemoryVectorStore> {
  const store = new MemoryVectorStore(createProxyEmbeddings());

  try {
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as PersistedStoreData;

    if (
      data.version !== STORE_VERSION ||
      data.embeddingModel !== expectedModel
    ) {
      console.warn(
        `Vector store version/model mismatch — reindexing needed. ` +
          `Store: v${data.version}/${data.embeddingModel}, expected: v${STORE_VERSION}/${expectedModel}`,
      );
      return store;
    }

    if (data.vectors.length > 0) {
      const embeddings = data.vectors.map((v) => v.embedding);
      const documents = data.vectors.map(
        (v) => new Document({ pageContent: v.content, metadata: v.metadata }),
      );
      await store.addVectors(embeddings, documents);
    }
  } catch {
    // File doesn't exist or is invalid — return empty store
  }

  return store;
}

export async function saveVectorStore(
  store: MemoryVectorStore,
  filePath: string,
  embeddingModel: string,
): Promise<void> {
  const vectors: PersistedVector[] = store.memoryVectors.map((v) => ({
    content: v.content,
    embedding: v.embedding,
    metadata: v.metadata,
  }));

  const data: PersistedStoreData = {
    version: STORE_VERSION,
    embeddingModel,
    vectors,
  };

  await writeFile(filePath, JSON.stringify(data), "utf-8");
}

export function getDocumentCount(store: MemoryVectorStore): number {
  return store.memoryVectors.length;
}
