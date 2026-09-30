import { describe, expect, it, vi } from "vitest";

import type { FavoriteItem } from "@/hooks/useFavorites";
import { remotePipelineReference } from "@/services/pipelineStorage/remotePipelineRecovery";

import {
  getFavoriteUrl,
  getItemStorageLabel,
  getRecentlyViewedUrl,
} from "./TypePill";

vi.mock("@/routes/router", async () => import("@/routes/appRoutes"));
vi.mock("@/components/shared/Settings/useFlags", () => ({
  isFlagEnabled: () => true,
}));

const backendUrl = "https://backend.example";
const pipelineId = "47a95130-267f-4e41-9469-3a8f935f4ac3";
const remoteReference = remotePipelineReference(backendUrl, pipelineId);

describe("dashboard pipeline links", () => {
  it.each([
    { id: remoteReference, expectedPath: pipelineId, label: "Remote" },
    {
      id: "document-id",
      pipelineReferenceId: remoteReference,
      expectedPath: pipelineId,
      label: "Remote",
    },
    {
      id: "document-id",
      pipelineReferenceId: "Local report",
      expectedPath: "Local%20report",
      label: "Local",
    },
    {
      id: "document-id",
      pipelineReferenceId: "pending:draft",
      expectedPath: "pending%3Adraft",
      label: "Pending upload",
    },
    { id: "Local report", expectedPath: "Local%20report", label: "Local" },
  ])(
    "uses the current location and preserves old saved links: $id / $pipelineReferenceId",
    ({ id, pipelineReferenceId, expectedPath, label }) => {
      const favorite: FavoriteItem = {
        type: "pipeline",
        id,
        name: "Report",
        pipelineReferenceId,
      };
      const expected = `/editor-v2/${expectedPath}`;

      expect(getFavoriteUrl(favorite, backendUrl)).toBe(expected);
      expect(
        getRecentlyViewedUrl({ ...favorite, timestamp: 1 }, backendUrl),
      ).toBe(expected);
      expect(getItemStorageLabel(favorite)).toBe(label);
    },
  );

  it("retains the backend scope when opening a saved link on another backend", () => {
    const item: FavoriteItem = {
      type: "pipeline",
      id: "document-id",
      name: "Report",
      pipelineReferenceId: remoteReference,
    };

    expect(getFavoriteUrl(item, "https://other.example")).toBe(
      `/editor-v2/${encodeURIComponent(remoteReference)}`,
    );
  });
});
