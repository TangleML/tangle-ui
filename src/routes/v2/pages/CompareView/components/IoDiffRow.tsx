import { BlockStack } from "@/components/ui/layout";
import type { IoDiff } from "@/routes/v2/pages/CompareView/utils/comparePipelines";

import { IoDiffDetail } from "./IoDiffDetail";

interface IoDiffRowProps {
  diff: IoDiff;
  labelA: string;
  labelB: string;
}

export function IoDiffRow({ diff, labelA, labelB }: IoDiffRowProps) {
  return (
    <BlockStack className="rounded-lg border border-border p-4">
      <IoDiffDetail diff={diff} labelA={labelA} labelB={labelB} />
    </BlockStack>
  );
}
