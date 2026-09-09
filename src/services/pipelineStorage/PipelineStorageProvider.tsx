import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";

import { startHostMigration } from "./hostMigration";
import {
  getPipelineStorageService,
  type PipelineStorageService,
} from "./PipelineStorageService";

export const PipelineStorageCtx = createRequiredContext<PipelineStorageService>(
  "PipelineStorageContext",
);

export function PipelineStorageProvider({ children }: { children: ReactNode }) {
  const [service] = useState(getPipelineStorageService);

  useEffect(() => {
    if (service.mode.kind !== "host") return;

    void startHostMigration(service.rootFolder).catch((error: unknown) => {
      console.error("Could not copy pipelines into the host store:", error);
    });
  }, [service]);

  return (
    <PipelineStorageCtx.Provider value={service}>
      {children}
    </PipelineStorageCtx.Provider>
  );
}

export function usePipelineStorage(): PipelineStorageService {
  return useRequiredContext(PipelineStorageCtx);
}
