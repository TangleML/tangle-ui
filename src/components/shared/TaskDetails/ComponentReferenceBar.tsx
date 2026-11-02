import type { ReactNode } from "react";

import ComponentDetailsDialog from "@/components/shared/Dialogs/ComponentDetailsDialog";
import { TrimmedDigest } from "@/components/shared/ManageComponent/TrimmedDigest";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentReference } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";
import { isSubgraph } from "@/utils/subgraphUtils";
import { tracking } from "@/utils/tracking";

interface ComponentReferenceBarProps {
  componentRef: ComponentReference;
  readOnly?: boolean;
  trackingId: string;
  children?: ReactNode;
}

export function ComponentReferenceBar({
  componentRef,
  readOnly = false,
  trackingId,
  children,
}: ComponentReferenceBarProps) {
  const displayName = componentRef.name ?? getComponentName(componentRef);
  const isSubgraphSpec = isSubgraph(componentRef.spec);

  return (
    <InlineStack
      gap="1"
      blockAlign="center"
      wrap="nowrap"
      className="w-full rounded-md border px-2 py-1"
    >
      <ComponentDetailsDialog
        component={componentRef}
        displayName={displayName}
        readOnly={readOnly}
        trigger={
          <button
            type="button"
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 hover:bg-accent"
            {...tracking(trackingId)}
          >
            <Icon
              name={isSubgraphSpec ? "Workflow" : "File"}
              size="sm"
              className={`shrink-0 ${isSubgraphSpec ? "text-blue-500" : "text-muted-foreground"}`}
            />
            <Text size="xs" className="truncate">
              {displayName}
            </Text>
            {componentRef.digest && (
              <TrimmedDigest
                digest={componentRef.digest}
                tooltip={false}
                className="shrink-0 text-muted-foreground"
              />
            )}
          </button>
        }
      />
      {children}
    </InlineStack>
  );
}
