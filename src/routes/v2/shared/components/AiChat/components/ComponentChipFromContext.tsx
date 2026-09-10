import { useQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";

import { getComponentQueryKey } from "@/hooks/useHydrateComponentReference";
import type { ComponentRefData } from "@/routes/v2/shared/components/AiChat/types";
import { hydrateComponentReference } from "@/services/componentService";

import { ComponentChip } from "./ComponentChip";

export const INLINE_CODE_CLASS =
  "rounded bg-muted px-1 py-0.5 text-xs font-mono";

export const ComponentRefsContext = createContext<
  Record<string, ComponentRefData> | undefined
>(undefined);

function useComponentRefData(
  componentId: string,
): ComponentRefData | undefined {
  const refs = useContext(ComponentRefsContext);
  const fromContext = refs?.[componentId];

  const { data: hydrated } = useQuery({
    queryKey: [
      "component",
      "hydrate",
      getComponentQueryKey({ digest: componentId }),
    ],
    staleTime: 1000 * 60 * 60,
    enabled: !fromContext,
    queryFn: () => hydrateComponentReference({ digest: componentId }),
  });

  if (fromContext) return fromContext;
  if (hydrated) return { name: hydrated.name, yamlText: hydrated.text };
  return undefined;
}

interface ComponentChipFromContextProps {
  componentId: string;
  label: string;
}

export function ComponentChipFromContext({
  componentId,
  label,
}: ComponentChipFromContextProps) {
  const refData = useComponentRefData(componentId);

  if (!refData) {
    return <span className={INLINE_CODE_CLASS}>{label}</span>;
  }

  return <ComponentChip componentRef={refData} label={label} />;
}
