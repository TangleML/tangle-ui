import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ComponentSpecJson } from "../src/models/componentSpec/entities/types";
import type { PipelineRepository, StoredPipeline } from "./pipelineRepository";

const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

interface StoredRoomFile {
  spec: ComponentSpecJson;
}

function isStoredRoomFile(value: unknown): value is StoredRoomFile {
  return (
    typeof value === "object" &&
    value !== null &&
    "spec" in value &&
    typeof value.spec === "object" &&
    value.spec !== null
  );
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export class FileSystemPipelineRepository implements PipelineRepository {
  readonly mode = "ephemeral";

  constructor(private readonly dataDir: string) {}

  async create(spec: ComponentSpecJson): Promise<string> {
    const roomId = randomUUID();
    await this.save(roomId, spec);
    return roomId;
  }

  async load(roomId: string): Promise<StoredPipeline | null> {
    const filePath = this.roomFilePath(roomId);
    if (!filePath) return null;

    let raw: string;
    try {
      raw = await readFile(filePath, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) return null;
      throw error;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isStoredRoomFile(parsed)) {
      throw new Error(`Room file ${filePath} is malformed`);
    }
    return { storageKey: roomId, spec: parsed.spec };
  }

  async save(roomId: string, spec: ComponentSpecJson): Promise<void> {
    const filePath = this.roomFilePath(roomId);
    if (!filePath) throw new Error(`Invalid room id "${roomId}"`);

    await mkdir(this.dataDir, { recursive: true });
    const contents: StoredRoomFile = { spec };
    const tempPath = `${filePath}.${randomUUID()}.tmp`;
    await writeFile(tempPath, JSON.stringify(contents), "utf8");
    await rename(tempPath, filePath);
  }

  private roomFilePath(roomId: string): string | null {
    if (!ROOM_ID_PATTERN.test(roomId)) return null;
    return path.join(this.dataDir, `${roomId}.json`);
  }
}
