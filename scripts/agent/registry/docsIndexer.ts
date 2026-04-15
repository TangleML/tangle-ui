#!/usr/bin/env tsx

/**
 * CLI tool to index Tangle documentation into the docs vector store.
 *
 * Usage:
 *   pnpm agent:index-docs [--docs-dir <path>] [--output <path>]
 *
 * Reads MDX/MD files from the Tangle website docs directory,
 * splits them into chunks by H2 headings, embeds via LangChain
 * MemoryVectorStore, and persists to disk.
 */
import { Document } from "@langchain/core/documents";
import { createHash } from "crypto";
import { readdirSync, readFileSync, statSync } from "fs";
import matter from "gray-matter";
import { basename, extname, join, relative } from "path";

import { config } from "../config";
import type { DocMetadata } from "./types";
import {
  createVectorStore,
  getDocumentCount,
  saveVectorStore,
} from "./vectorStoreFactory";

const DOCS_BASE_URL = "https://tangleml.com/docs";

interface DocFrontmatter {
  id?: string;
  title?: string;
  slug?: string;
  description?: string;
  sidebar_label?: string;
}

interface DocChunk {
  id: string;
  title: string;
  sectionTitle: string;
  content: string;
  url: string;
}

function globDocs(dir: string): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...globDocs(fullPath));
    } else if (/\.(mdx?|md)$/.test(entry)) {
      results.push(fullPath);
    }
  }

  return results;
}

function stripMdxSyntax(content: string): string {
  return content
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("import ")) return false;
      if (trimmed.startsWith("export ")) return false;
      return true;
    })
    .join("\n")
    .replace(/<[A-Z][a-zA-Z]*\b[^>]*\/>/g, "")
    .replace(/<[A-Z][a-zA-Z]*\b[^>]*>[\s\S]*?<\/[A-Z][a-zA-Z]*>/g, "")
    .replace(/<[a-z][a-zA-Z]*\b[^>]*\/>/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function computeDocUrl(
  filePath: string,
  docsDir: string,
  frontmatter: DocFrontmatter,
): string {
  if (frontmatter.slug === "/") {
    return DOCS_BASE_URL;
  }

  if (frontmatter.slug) {
    return `${DOCS_BASE_URL}${frontmatter.slug}`;
  }

  const rel = relative(docsDir, filePath);
  const dir = rel.includes("/") ? rel.substring(0, rel.lastIndexOf("/")) : null;

  const docId = frontmatter.id ?? basename(filePath, extname(filePath));

  if (dir) {
    return `${DOCS_BASE_URL}/${dir}/${docId}`;
  }
  return `${DOCS_BASE_URL}/${docId}`;
}

function splitByHeadings(
  content: string,
  pageTitle: string,
  url: string,
  fileId: string,
): DocChunk[] {
  const lines = content.split("\n");
  const chunks: DocChunk[] = [];
  let currentSection = pageTitle;
  let currentLines: string[] = [];

  function flushChunk() {
    const text = currentLines.join("\n").trim();
    if (text.length < 30) return;

    const sectionSlug =
      currentSection === pageTitle ? "intro" : slugify(currentSection);
    chunks.push({
      id: `${fileId}#${sectionSlug}`,
      title: pageTitle,
      sectionTitle: currentSection,
      content: text,
      url,
    });
  }

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)/);
    if (h2Match) {
      flushChunk();
      currentSection = h2Match[1].replace(/\{#[^}]+\}/, "").trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  flushChunk();

  if (chunks.length === 0 && content.trim().length >= 30) {
    chunks.push({
      id: `${fileId}#full`,
      title: pageTitle,
      sectionTitle: pageTitle,
      content: content.trim(),
      url,
    });
  }

  return chunks;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildEmbeddingText(chunk: DocChunk): string {
  const parts = [`title: ${chunk.title}`];
  if (chunk.sectionTitle !== chunk.title) {
    parts.push(`section: ${chunk.sectionTitle}`);
  }
  parts.push(`\n${chunk.content}`);
  return parts.join("\n");
}

function buildDocuments(allChunks: DocChunk[]): Document<DocMetadata>[] {
  const seen = new Set<string>();

  return allChunks
    .map((chunk) => {
      const contentForHash = `${chunk.id}:${chunk.content}`;
      const hash = createHash("sha256").update(contentForHash).digest("hex");

      if (seen.has(hash)) return null;
      seen.add(hash);

      const metadata: DocMetadata = {
        id: chunk.id,
        title: chunk.title,
        sectionTitle: chunk.sectionTitle,
        url: chunk.url,
        contentHash: hash,
      };

      return new Document({ pageContent: buildEmbeddingText(chunk), metadata });
    })
    .filter((doc): doc is Document<DocMetadata> => doc !== null);
}

async function main() {
  const args = process.argv.slice(2);
  let docsDir = "../website/docs";
  let outputPath = config.docsVectorStorePath;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--docs-dir" && args[i + 1]) {
      docsDir = args[++i];
    } else if (args[i] === "--output" && args[i + 1]) {
      outputPath = args[++i];
    }
  }

  console.log(`Docs directory: ${docsDir}`);
  const files = globDocs(docsDir);
  console.log(`Found ${files.length} doc files`);

  if (files.length === 0) {
    console.error("No docs found. Check --docs-dir path.");
    process.exit(1);
  }

  const allChunks: DocChunk[] = [];

  for (const filePath of files) {
    const raw = readFileSync(filePath, "utf-8");
    const { data: frontmatter, content: rawContent } = matter(
      raw,
    ) as unknown as {
      data: DocFrontmatter;
      content: string;
    };

    const title = frontmatter.title ?? basename(filePath, extname(filePath));
    const url = computeDocUrl(filePath, docsDir, frontmatter);
    const fileId = frontmatter.id ?? basename(filePath, extname(filePath));

    const content = stripMdxSyntax(rawContent);
    const chunks = splitByHeadings(content, title, url, fileId);

    console.log(`  ${basename(filePath)}: ${chunks.length} chunks → ${url}`);
    allChunks.push(...chunks);
  }

  const documents = buildDocuments(allChunks);
  console.log(`\nEmbedding ${documents.length} doc chunks...`);

  const vectorStore = await createVectorStore(documents);
  await saveVectorStore(vectorStore, outputPath, config.embeddingModel);

  console.log(`Done. Total: ${getDocumentCount(vectorStore)} records.`);
  console.log(`Saved to: ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
