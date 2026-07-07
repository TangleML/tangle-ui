import type { ReactNode } from "react";
import { useState } from "react";

import { PipelineStorageCtx } from "@/services/pipelineStorage/PipelineStorageProvider";

import { TourPipelineStorageService } from "./TourPipelineStorageService";

export function TourPipelineStorageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [service] = useState(() => new TourPipelineStorageService());

  return (
    <PipelineStorageCtx.Provider value={service}>
      {children}
    </PipelineStorageCtx.Provider>
  );
}
