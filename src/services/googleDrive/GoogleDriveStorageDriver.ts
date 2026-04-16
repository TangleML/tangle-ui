import type {
  DriverPermissions,
  PermissionStatus,
  PipelineFileDescriptor,
  PipelineStorageDriver,
} from "../pipelineStorage/types";
import type { GoogleDriveAuthService } from "./GoogleDriveAuthService";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const PIPELINE_YAML_PATTERN = /\.pipeline\.component\.ya?ml$/i;
const PIPELINE_SUFFIX = ".pipeline.component.yaml";

function toFileName(storageKey: string): string {
  if (PIPELINE_YAML_PATTERN.test(storageKey)) return storageKey;
  return storageKey + PIPELINE_SUFFIX;
}

class GoogleDrivePermissions implements DriverPermissions {
  constructor(private readonly auth: GoogleDriveAuthService) {}

  async check(): Promise<PermissionStatus> {
    return this.auth.isAuthenticated() ? "granted" : "prompt";
  }

  async request(): Promise<boolean> {
    try {
      await this.auth.requestToken();
      return true;
    } catch {
      return false;
    }
  }
}

export class GoogleDriveStorageDriver implements PipelineStorageDriver {
  readonly type = "google-drive";
  readonly allowsMoveIn = false;
  readonly allowsMoveOut = false;
  readonly permissions: DriverPermissions;

  constructor(
    private readonly folderId: string,
    private readonly auth: GoogleDriveAuthService,
  ) {
    this.permissions = new GoogleDrivePermissions(auth);
  }

  async list(): Promise<PipelineFileDescriptor[]> {
    const query = [
      `'${this.folderId}' in parents`,
      `name contains '.pipeline.component.yaml' or name contains '.pipeline.component.yml'`,
      "trashed = false",
    ].join(" and ");

    const params = new URLSearchParams({
      q: query,
      fields: "files(id,name,modifiedTime,createdTime)",
      orderBy: "modifiedTime desc",
      pageSize: "1000",
    });

    const response = await this.fetchApi(`/files?${params.toString()}`);
    const data = (await response.json()) as {
      files?: Array<{
        id: string;
        name: string;
        modifiedTime?: string;
        createdTime?: string;
      }>;
    };

    return (data.files ?? [])
      .filter((f) => PIPELINE_YAML_PATTERN.test(f.name))
      .map((f) => ({
        storageKey: f.name,
        modifiedAt: f.modifiedTime ? new Date(f.modifiedTime) : undefined,
        createdAt: f.createdTime ? new Date(f.createdTime) : undefined,
      }));
  }

  async read(storageKey: string): Promise<string> {
    const fileId = await this.resolveFileId(storageKey);
    if (!fileId) {
      throw new Error(`File not found in Google Drive: ${storageKey}`);
    }

    const response = await this.fetchApi(`/files/${fileId}?alt=media`);
    return response.text();
  }

  async write(storageKey: string, content: string): Promise<void> {
    const fileName = toFileName(storageKey);
    const existingId = await this.resolveFileId(storageKey);

    if (existingId) {
      await this.updateFileContent(existingId, content);
    } else {
      await this.createFile(fileName, content);
    }
  }

  async rename(oldStorageKey: string, newStorageKey: string): Promise<void> {
    const fileId = await this.resolveFileId(oldStorageKey);
    if (!fileId) {
      throw new Error(`File not found in Google Drive: ${oldStorageKey}`);
    }

    const newFileName = toFileName(newStorageKey);
    await this.fetchApi(`/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFileName }),
    });
  }

  async delete(storageKey: string): Promise<void> {
    const fileId = await this.resolveFileId(storageKey);
    if (!fileId) return;
    await this.fetchApi(`/files/${fileId}`, { method: "DELETE" });
  }

  async hasKey(storageKey: string): Promise<boolean> {
    const fileId = await this.resolveFileId(storageKey);
    return fileId != null;
  }

  // --- Private helpers ---

  private async resolveFileId(storageKey: string): Promise<string | null> {
    const fileName = toFileName(storageKey);
    const query = [
      `'${this.folderId}' in parents`,
      `name = '${escapeDriveQuery(fileName)}'`,
      "trashed = false",
    ].join(" and ");

    const params = new URLSearchParams({
      q: query,
      fields: "files(id)",
      pageSize: "1",
    });

    const response = await this.fetchApi(`/files?${params.toString()}`);
    const data = (await response.json()) as {
      files?: Array<{ id: string }>;
    };

    return data.files?.[0]?.id ?? null;
  }

  private async createFile(fileName: string, content: string): Promise<void> {
    const metadata = {
      name: fileName,
      parents: [this.folderId],
      mimeType: "text/yaml",
    };

    const boundary = "----GoogleDriveBoundary";
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: text/yaml",
      "",
      content,
      `--${boundary}--`,
    ].join("\r\n");

    const token = await this.requireToken();
    const response = await fetch(
      `${UPLOAD_API}/files?uploadType=multipart&fields=id`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );

    if (!response.ok) {
      throw new Error(`Google Drive upload failed: ${response.status}`);
    }
  }

  private async updateFileContent(
    fileId: string,
    content: string,
  ): Promise<void> {
    const token = await this.requireToken();
    const response = await fetch(
      `${UPLOAD_API}/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "text/yaml",
        },
        body: content,
      },
    );

    if (!response.ok) {
      throw new Error(`Google Drive update failed: ${response.status}`);
    }
  }

  private async fetchApi(path: string, init?: RequestInit): Promise<Response> {
    const token = await this.requireToken();
    const response = await fetch(`${DRIVE_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Google Drive API error ${response.status}: ${text}`);
    }

    return response;
  }

  private async requireToken(): Promise<string> {
    if (!this.auth.isAuthenticated()) {
      try {
        await this.auth.requestToken();
      } catch {
        throw new Error(
          "Google Drive session expired. Re-authenticate via the folder's Grant Access button.",
        );
      }
    }
    const token = this.auth.getAccessToken();
    if (!token) {
      throw new Error(
        "Google Drive session expired. Re-authenticate via the folder's Grant Access button.",
      );
    }
    return token;
  }
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
