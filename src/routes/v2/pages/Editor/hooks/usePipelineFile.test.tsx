import "fake-indexeddb/auto";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { useId, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { pipelineStorageDb } from "@/services/pipelineStorage/db";
import type { PipelineFile } from "@/services/pipelineStorage/PipelineFile";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { PipelineStorageService } from "@/services/pipelineStorage/PipelineStorageService";
import {
  remotePipelineRecoveryDb,
  remotePipelineReference,
} from "@/services/pipelineStorage/remotePipelineRecovery";
import type { PipelineRef } from "@/services/pipelineStorage/types";

import { usePipelineFile } from "./usePipelineFile";

vi.mock("@/services/pipelineStorage/PipelineStorageProvider", () => ({
  usePipelineStorage: vi.fn(),
}));
vi.mock("@/services/errorManagement/bugsnag", () => ({
  reportError: vi.fn(),
}));
vi.mock("@/utils/componentStore", () => ({
  getAllComponentFilesFromList: vi.fn(async () => new Map()),
  getComponentFileFromList: vi.fn(),
}));

const BACKEND = "https://backend.example.com";
const OTHER_BACKEND = "https://other.example.com";
const REMOTE_ID = "20000000-0000-4000-8000-000000000001";

function storageFor(backendUrl = BACKEND) {
  return new PipelineStorageService({
    scope: JSON.stringify([backendUrl, "owner@example.com"]),
    connection: { backendUrl, authorizationToken: "token" },
  });
}

function EditingSession({ file }: { file: PipelineFile }) {
  const [edits, setEdits] = useState(0);
  return (
    <button data-file-id={file.id} onClick={() => setEdits(edits + 1)}>
      Edits: {edits}
    </button>
  );
}

function ResolvedPipeline({
  pipelineRef,
  editorId,
}: {
  pipelineRef: PipelineRef;
  editorId: string;
}) {
  const storage = usePipelineStorage();
  const { data: file } = usePipelineFile(pipelineRef, editorId);
  if (!file) return null;
  return <EditingSession key={`${storage.scope}:${file.id}`} file={file} />;
}

function PipelineWithBoundary({ pipelineRef }: { pipelineRef: PipelineRef }) {
  const storage = usePipelineStorage();
  const editorId = useId();
  return (
    <SuspenseWrapper
      fallback="Loading pipeline"
      errorFallback={({ error }) => (
        <div role="alert">
          {error instanceof Error ? error.message : String(error)}
        </div>
      )}
      resetKeys={[storage.scope, pipelineRef.fileId, pipelineRef.name]}
    >
      <ResolvedPipeline pipelineRef={pipelineRef} editorId={editorId} />
    </SuspenseWrapper>
  );
}

function pipelineView(client: QueryClient, pipelineRef: PipelineRef) {
  return (
    <QueryClientProvider client={client}>
      <PipelineWithBoundary pipelineRef={pipelineRef} />
    </QueryClientProvider>
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  await pipelineStorageDb.pipeline_registry.clear();
  await remotePipelineRecoveryDb.copies.clear();
  vi.mocked(usePipelineStorage).mockReturnValue(storageFor());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("pipeline resolution error boundary", () => {
  it.each(["scope", "name", "fileId"] as const)(
    "recovers from a wrong-backend lookup when %s is corrected",
    async (changedInput) => {
      const client = new QueryClient();
      const wrongReference = remotePipelineReference(OTHER_BACKEND, REMOTE_ID);
      let pipelineRef: PipelineRef =
        changedInput === "fileId"
          ? { name: "Pipeline", fileId: wrongReference }
          : { name: wrongReference };
      const view = render(pipelineView(client, pipelineRef));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "This pipeline belongs to a different backend.",
      );

      if (changedInput === "scope") {
        vi.mocked(usePipelineStorage).mockReturnValue(
          storageFor(OTHER_BACKEND),
        );
      } else {
        pipelineRef = {
          ...pipelineRef,
          [changedInput]: remotePipelineReference(BACKEND, REMOTE_ID),
        };
      }
      view.rerender(pipelineView(client, pipelineRef));

      expect(
        await screen.findByRole("button", { name: "Edits: 0" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      view.unmount();
      client.clear();
    },
  );

  it("preserves the editing session when a healthy locator becomes canonical", async () => {
    const client = new QueryClient();
    const view = render(
      pipelineView(client, { name: "Pipeline", fileId: REMOTE_ID }),
    );
    const editor = await screen.findByRole("button", { name: "Edits: 0" });
    const documentId = editor.getAttribute("data-file-id");
    fireEvent.click(editor);

    view.rerender(
      pipelineView(client, {
        name: remotePipelineReference(BACKEND, REMOTE_ID),
      }),
    );

    expect(
      await screen.findByRole("button", { name: "Edits: 1" }),
    ).toHaveAttribute("data-file-id", documentId);
    view.unmount();
    client.clear();
  });
});
