import { useEffect, useState } from "react";

import {
  claimHostMigration,
  dismissHostMigration,
  type HostMigrationProgress,
  readHostMigration,
  runHostMigration,
} from "@/services/pipelineStorage/hostMigration";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import { getErrorMessage } from "@/utils/string";

type HostMigrationPhase = "checking" | "copying" | "incomplete" | "settled";

export interface HostMigration {
  phase: HostMigrationPhase;
  progress: HostMigrationProgress;
  failed: string[];
  error: string | null;
  retry: () => void;
  skip: () => void;
}

const NOTHING: HostMigrationProgress = { copied: 0, failed: 0, total: 0 };

const POLL_MS = 1_000;

/**
 * Copies browser-stored pipelines into a host-provided store the first time the
 * app runs against one, so a user does not arrive to an empty library. It runs
 * where the list would be rather than in front of the whole app: a store that
 * cannot be reached must not be able to lock anyone out of the editor.
 */
export function useHostMigration(onFinished: () => void): HostMigration {
  const storage = usePipelineStorage();
  const isHost = storage.mode.kind === "host";

  const [phase, setPhase] = useState<HostMigrationPhase>(
    isHost ? "checking" : "settled",
  );
  const [progress, setProgress] = useState<HostMigrationProgress>(NOTHING);
  const [failed, setFailed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isHost) return;

    let watching = true;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const settle = (failedKeys: string[]) => {
      if (!watching) return;
      setFailed(failedKeys);
      setError(null);
      setPhase(failedKeys.length > 0 ? "incomplete" : "settled");
      if (failedKeys.length === 0) onFinished();
    };

    /**
     * Claiming again rather than only reading is what recovers a claim whose
     * holder is gone — a crashed tab, or this effect's own first run under
     * StrictMode. The copying itself is deliberately not cancelled when the
     * component goes away; only what it reports back is.
     */
    const pump = async (): Promise<void> => {
      const claim = await claimHostMigration();

      if (claim === "settled") {
        settle((await readHostMigration())?.failed ?? []);
        return;
      }

      if (watching) setPhase("copying");

      if (claim === "claimed") {
        const record = await runHostMigration(storage.rootFolder, (update) => {
          if (watching) setProgress(update);
        });
        settle(record.failed);
        return;
      }

      const record = await readHostMigration();
      if (!watching) return;

      setProgress({
        copied: record?.copied.length ?? 0,
        failed: record?.failed.length ?? 0,
        total: 0,
      });
      pollTimer = setTimeout(() => void pump(), POLL_MS);
    };

    /**
     * Whatever goes wrong, this has to stop looking like it is still working.
     * A copy that throws — an unreadable local pipeline, a store refusing the
     * whole listing — would otherwise leave the page on "starting…" forever.
     */
    void pump().catch((thrown: unknown) => {
      console.error("Could not copy pipelines into the host store:", thrown);
      if (!watching) return;
      setError(getErrorMessage(thrown));
      setPhase("incomplete");
    });

    return () => {
      watching = false;
      clearTimeout(pollTimer);
    };
  }, [isHost, storage, attempt, onFinished]);

  return {
    phase,
    progress,
    failed,
    error,
    retry: () => setAttempt((previous) => previous + 1),
    skip: () => {
      void dismissHostMigration().then(() => {
        setPhase("settled");
        onFinished();
      });
    },
  };
}
