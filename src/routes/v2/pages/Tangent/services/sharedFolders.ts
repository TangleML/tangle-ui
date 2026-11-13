import { isRecord } from "@/utils/typeGuards";

const SHARED_FOLDER_TIMEOUT_MS = 15000;

interface CreateSharedFolderParams {
  baseUrl: string;
  authToken?: string;
  name?: string;
}

interface TangentSharedFolder {
  id: string;
}

function parseSharedFolder(value: unknown): TangentSharedFolder {
  if (
    !isRecord(value) ||
    !isRecord(value.folder) ||
    typeof value.folder.id !== "string"
  ) {
    throw new Error("Tangent shared folder response was malformed.");
  }
  return { id: value.folder.id };
}

export async function createTangentSharedFolder({
  baseUrl,
  authToken,
  name,
}: CreateSharedFolderParams): Promise<TangentSharedFolder> {
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, "")}/api/shared-folders`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(name ? { name } : {}),
      signal: AbortSignal.timeout(SHARED_FOLDER_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to create Tangent shared folder (${response.status} ${response.statusText}).`,
    );
  }
  return parseSharedFolder(await response.json());
}
