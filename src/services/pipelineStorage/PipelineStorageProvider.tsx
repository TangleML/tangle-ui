import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";

import { PipelineStorageService } from "./PipelineStorageService";

const PipelineStorageCtx = createRequiredContext<PipelineStorageService>(
  "PipelineStorageContext",
);

export function PipelineStorageProvider({ children }: { children: ReactNode }) {
  const [service] = useState(() => new PipelineStorageService());
  useEffect(() => service.connect(), [service]);

  return (
    <PipelineStorageCtx.Provider value={service}>
      {children}
    </PipelineStorageCtx.Provider>
  );
}

export function usePipelineStorage(): PipelineStorageService {
  return useRequiredContext(PipelineStorageCtx);
}
