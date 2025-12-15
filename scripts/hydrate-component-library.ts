#!/usr/bin/env node

import crypto from "crypto";
import fs from "fs/promises";
import http from "http";
import https from "https";
import yaml from "js-yaml";
import process from "process";

// Type definitions
interface ComponentSpec {
  name?: string;
  metadata?: {
    annotations?: {
      author?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface BaseComponent {
  url?: string;
  [key: string]: unknown;
}

interface ProcessedComponent extends BaseComponent {
  name?: string | null;
  author?: string | null;
  digest?: string;
  fetched_at?: string;
  error?: string;
}

interface Folder {
  components?: BaseComponent[];
  folders?: Folder[];
  [key: string]: unknown;
}

interface ProcessedFolder extends Omit<Folder, "components" | "folders"> {
  components?: ProcessedComponent[];
  folders?: ProcessedFolder[];
}

interface ComponentLibrary {
  folders: Folder[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

interface HydratedComponentLibrary extends Omit<ComponentLibrary, "folders"> {
  folders: ProcessedFolder[];
  metadata: {
    augmented_at?: string;
    augmented_by?: string;
    [key: string]: unknown;
  };
}

/**
 * Generate a SHA-256 digest for a given text
 * @param text - The text to hash
 * @returns The hex-encoded digest
 */
async function generateDigest(text: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Download content from a URL
 * @param url - The URL to download from
 * @returns The downloaded content
 */
function downloadContent(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(
            new Error(
              `Failed to download ${url}: ${res.statusCode} ${res.statusMessage}`,
            ),
          );
          return;
        }

        let data = "";
        res.on("data", (chunk: Buffer | string) => {
          data += chunk;
        });

        res.on("end", () => {
          resolve(data);
        });

        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function isValidComponentSpec(spec: unknown): spec is ComponentSpec {
  return typeof spec === "object" && spec !== null;
}

function parseComponentSpec(content: string): ComponentSpec {
  const spec = yaml.load(content);
  if (!isValidComponentSpec(spec)) {
    throw new Error("Invalid component specification format");
  }
  return spec;
}

/**
 * Process a single component by downloading and extracting metadata
 * @param component - The component object with URL
 * @returns The augmented component
 */
async function processComponent(
  component: BaseComponent,
): Promise<ProcessedComponent> {
  if (!component.url) {
    return component;
  }

  try {
    console.log(`Processing: ${component.url}`);

    // Download the component YAML
    const content = await downloadContent(component.url);

    // Parse the YAML to get ComponentSpec
    const componentSpec = parseComponentSpec(content);

    // Extract fields
    const name = componentSpec.name || null;
    const author = componentSpec.metadata?.annotations?.author || null;
    const digest = await generateDigest(content);
    const fetched_at = new Date().toISOString();

    // Return augmented component
    return {
      ...component,
      name,
      author,
      digest,
      fetched_at,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing ${component.url}:`, errorMessage);
    // Return original component with error info
    return {
      ...component,
      error: errorMessage,
      fetched_at: new Date().toISOString(),
    };
  }
}

/**
 * Process a folder recursively
 * @param folder - The folder object
 * @returns The processed folder
 */
async function processFolder(folder: Folder): Promise<ProcessedFolder> {
  const processedFolder: ProcessedFolder = {
    ...folder,
    components: undefined,
    folders: undefined,
  };

  // Process components in this folder
  if (folder.components && Array.isArray(folder.components)) {
    processedFolder.components = await Promise.all(
      folder.components.map(processComponent),
    );
  }

  // Process subfolders recursively
  if (folder.folders && Array.isArray(folder.folders)) {
    processedFolder.folders = await Promise.all(
      folder.folders.map(processFolder),
    );
  }

  return processedFolder;
}

/**
 * Count components recursively for statistics
 * @param folder - The folder to count components in
 * @param stats - Statistics accumulator
 */
function countComponents(
  folder: ProcessedFolder,
  stats: { total: number; successful: number; failed: number },
): void {
  if (folder.components) {
    folder.components.forEach((comp) => {
      stats.total++;
      if (comp.error) {
        stats.failed++;
      } else if (comp.digest) {
        stats.successful++;
      }
    });
  }
  if (folder.folders) {
    folder.folders.forEach((subfolder) => countComponents(subfolder, stats));
  }
}

/**
 * Main function to process the component library
 */
async function main(): Promise<void> {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const inputFile = args[0] || "public/component_library.yaml";
    const outputFile = args[1] || "public/component_library_augmented.yaml";

    console.log(`Reading component library from: ${inputFile}`);

    // Read the component library file
    const libraryContent = await fs.readFile(inputFile, "utf8");
    const library = yaml.load(libraryContent) as ComponentLibrary;

    console.log("Processing component library...");

    // Process all folders
    const augmentedLibrary: HydratedComponentLibrary = {
      ...library,
      folders: await Promise.all(library.folders.map(processFolder)),
      metadata: {
        ...library.metadata,
        augmented_at: new Date().toISOString(),
        augmented_by: "augment-component-library script",
      },
    };

    // Write the augmented library
    const outputContent = yaml.dump(augmentedLibrary, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    });

    await fs.writeFile(outputFile, outputContent, "utf8");
    console.log(`Augmented component library saved to: ${outputFile}`);

    // Print summary
    const stats = { total: 0, successful: 0, failed: 0 };
    augmentedLibrary.folders.forEach((folder) =>
      countComponents(folder, stats),
    );

    console.log("\nSummary:");
    console.log(`Total components: ${stats.total}`);
    console.log(`Successfully processed: ${stats.successful}`);
    console.log(`Failed: ${stats.failed}`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Run the main function
void main();
