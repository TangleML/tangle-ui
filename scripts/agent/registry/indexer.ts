#!/usr/bin/env tsx

/**
 * CLI tool to index component libraries into the vector store.
 *
 * Usage:
 *   pnpm agent:index [--library <path>]... [--output <path>] [--skip-hydration]
 *
 * Reads YAML component library files, extracts component metadata,
 * hydrates components lacking text/spec by fetching from their URL,
 * embeds descriptions via LangChain MemoryVectorStore, and persists to disk.
 */
import { Document } from "@langchain/core/documents";
import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { load as loadYaml } from "js-yaml";
import { resolve } from "path";

import { config } from "../config";
import type { ComponentMetadata } from "./types";
import {
  createVectorStore,
  getDocumentCount,
  saveVectorStore,
} from "./vectorStoreFactory";

interface ComponentRef {
  name?: string;
  url?: string;
  text?: string;
  description?: string;
  digest?: string;
  spec?: {
    name?: string;
    description?: string;
    inputs?: Array<{ name: string; type?: string }>;
    outputs?: Array<{ name: string; type?: string }>;
  };
}

interface LibraryFolder {
  name: string;
  components?: ComponentRef[];
  folders?: LibraryFolder[];
}

interface LibraryFile {
  annotations?: Record<string, unknown>;
  folders: LibraryFolder[];
}

function extractComponents(
  folders: LibraryFolder[],
  path: string[] = [],
): Array<{ component: ComponentRef; folderPath: string[] }> {
  const results: Array<{ component: ComponentRef; folderPath: string[] }> = [];

  for (const folder of folders) {
    const currentPath = [...path, folder.name];

    if (folder.components) {
      for (const comp of folder.components) {
        results.push({ component: comp, folderPath: currentPath });
      }
    }

    if (folder.folders) {
      results.push(...extractComponents(folder.folders, currentPath));
    }
  }

  return results;
}

function buildEmbeddingText(
  comp: ComponentRef,
  folderPath: string[],
  parsedYaml?: Record<string, unknown>,
): string {
  const parts: string[] = [];

  const name = comp.name ?? parsedYaml?.name ?? "Unknown";
  parts.push(`name: ${name}`);

  const description =
    comp.description ?? (parsedYaml?.description as string | undefined) ?? "";
  if (description) {
    parts.push(`description: ${description}`);
  }

  parts.push(`category: ${folderPath.join(" / ")}`);

  const inputs =
    comp.spec?.inputs ??
    (parsedYaml?.inputs as
      | Array<{ name: string; type?: string }>
      | undefined) ??
    [];
  if (inputs.length > 0) {
    parts.push(
      `inputs: ${inputs.map((i) => `${i.name}${i.type ? `: ${i.type}` : ""}`).join(", ")}`,
    );
  }

  const outputs =
    comp.spec?.outputs ??
    (parsedYaml?.outputs as
      | Array<{ name: string; type?: string }>
      | undefined) ??
    [];
  if (outputs.length > 0) {
    parts.push(
      `outputs: ${outputs.map((o) => `${o.name}${o.type ? `: ${o.type}` : ""}`).join(", ")}`,
    );
  }

  return parts.join("\n");
}

function parseInlineYaml(text: string): Record<string, unknown> | null {
  try {
    return loadYaml(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchComponentText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = (await response.json()) as { text?: string };
      if (json.text) return json.text;
    }

    return await response.text();
  } catch (err) {
    console.warn(
      `  Failed to fetch ${url}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function hydrateComponent(comp: ComponentRef): Promise<ComponentRef> {
  if (comp.text || comp.spec) return comp;
  if (!comp.url) return comp;

  const text = await fetchComponentText(comp.url);
  if (!text) return comp;

  const parsed = parseInlineYaml(text);
  if (!parsed) return { ...comp, text };

  return {
    ...comp,
    text,
    description: comp.description ?? (parsed.description as string | undefined),
    spec: {
      name: comp.name ?? (parsed.name as string | undefined),
      description:
        comp.description ?? (parsed.description as string | undefined),
      inputs: (parsed.inputs as Array<{ name: string; type?: string }>) ?? [],
      outputs: (parsed.outputs as Array<{ name: string; type?: string }>) ?? [],
    },
  };
}

const HYDRATE_CONCURRENCY = 10;

async function hydrateExtractedComponents(
  extracted: Array<{ component: ComponentRef; folderPath: string[] }>,
): Promise<number> {
  let hydratedCount = 0;
  const needsHydration = extracted.filter(
    (e) => !e.component.text && !e.component.spec && e.component.url,
  );

  console.log(
    `Hydrating ${needsHydration.length}/${extracted.length} components from URL...`,
  );

  for (let i = 0; i < needsHydration.length; i += HYDRATE_CONCURRENCY) {
    const batch = needsHydration.slice(i, i + HYDRATE_CONCURRENCY);
    await Promise.all(
      batch.map(async (entry) => {
        const hydrated = await hydrateComponent(entry.component);
        if (hydrated !== entry.component) {
          entry.component = hydrated;
          hydratedCount++;
        }
      }),
    );
  }

  console.log(
    `Hydrated ${hydratedCount}/${needsHydration.length} components from URL`,
  );
  return hydratedCount;
}

function buildDocuments(
  extracted: Array<{ component: ComponentRef; folderPath: string[] }>,
): Document<ComponentMetadata>[] {
  const seen = new Set<string>();

  return extracted
    .map(({ component, folderPath }) => {
      const parsedYaml = component.text
        ? parseInlineYaml(component.text)
        : null;

      const contentForHash =
        component.text ?? component.url ?? JSON.stringify(component);
      const hash = createHash("sha256").update(contentForHash).digest("hex");

      if (seen.has(hash)) return null;
      seen.add(hash);

      const id = component.digest ?? hash.substring(0, 16);

      const name =
        component.name ??
        (parsedYaml?.name as string | undefined) ??
        `Component ${id}`;
      const description =
        component.description ??
        (parsedYaml?.description as string | undefined) ??
        "";

      const pageContent = buildEmbeddingText(
        component,
        folderPath,
        parsedYaml ?? undefined,
      );

      const metadata: ComponentMetadata = {
        id,
        name,
        description,
        yamlText: component.text ?? `url: ${component.url}`,
        inputs:
          component.spec?.inputs ??
          (parsedYaml?.inputs as Array<{ name: string; type?: string }>) ??
          [],
        outputs:
          component.spec?.outputs ??
          (parsedYaml?.outputs as Array<{ name: string; type?: string }>) ??
          [],
        contentHash: hash,
      };

      return new Document({ pageContent, metadata });
    })
    .filter((doc): doc is Document<ComponentMetadata> => doc !== null);
}

async function indexLibrary(
  libraryPath: string,
  skipHydration: boolean,
): Promise<Document<ComponentMetadata>[]> {
  console.log(`Reading library: ${libraryPath}`);
  const raw = await readFile(libraryPath, "utf-8");
  const lib = loadYaml(raw) as LibraryFile;

  if (!lib.folders) {
    console.warn(`No folders in ${libraryPath}, skipping`);
    return [];
  }

  const extracted = extractComponents(lib.folders);
  console.log(`Found ${extracted.length} components`);

  if (!skipHydration) {
    await hydrateExtractedComponents(extracted);
  }

  return buildDocuments(extracted);
}

async function main() {
  const args = process.argv.slice(2);
  const libraries: string[] = [];
  let outputPath = config.vectorStorePath;
  let skipHydration = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--library" && args[i + 1]) {
      libraries.push(args[++i]);
    } else if (args[i] === "--output" && args[i + 1]) {
      outputPath = args[++i];
    } else if (args[i] === "--skip-hydration") {
      skipHydration = true;
    }
  }

  if (libraries.length === 0) {
    libraries.push(
      resolve("public/component_library.yaml"),
      resolve("public/component_library.custom.yaml"),
      resolve("public/component_library.discovery.yaml"),
    );
  }

  if (skipHydration) {
    console.log("Skipping component hydration (--skip-hydration)");
  }

  const allDocuments: Document<ComponentMetadata>[] = [];

  for (const lib of libraries) {
    try {
      const docs = await indexLibrary(lib, skipHydration);
      allDocuments.push(...docs);
    } catch (err) {
      console.error(
        `Error indexing ${lib}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(`\nEmbedding ${allDocuments.length} components...`);
  const vectorStore = await createVectorStore(allDocuments);
  await saveVectorStore(vectorStore, outputPath, config.embeddingModel);

  console.log(`Done. Total: ${getDocumentCount(vectorStore)} records.`);
  console.log(`Saved to: ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
