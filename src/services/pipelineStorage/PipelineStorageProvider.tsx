import type { ReactNode } from "react";
import { useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";

import {
  getPipelineStorageService,
  type PipelineStorageService,
} from "./PipelineStorageService";

export const PipelineStorageCtx = createRequiredContext<PipelineStorageService>(
  "PipelineStorageContext",
);

export function PipelineStorageProvider({ children }: { children: ReactNode }) {
  const [service] = useState(getPipelineStorageService);

  return (
    <PipelineStorageCtx.Provider value={service}>
      {children}
    </PipelineStorageCtx.Provider>
  );
}

export function usePipelineStorage(): PipelineStorageService {
  return useRequiredContext(PipelineStorageCtx);
}
