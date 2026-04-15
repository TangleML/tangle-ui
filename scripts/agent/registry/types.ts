/**
 * Metadata interfaces for LangChain Document.metadata.
 * These provide type-safe access to domain fields stored alongside embeddings.
 */

export interface ComponentMetadata {
  id: string;
  name: string;
  description: string;
  yamlText: string;
  inputs: Array<{ name: string; type?: string }>;
  outputs: Array<{ name: string; type?: string }>;
  contentHash: string;
}

export interface DocMetadata {
  id: string;
  title: string;
  sectionTitle: string;
  url: string;
  contentHash: string;
}
