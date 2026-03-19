import { useSuspenseQuery } from "@tanstack/react-query";

import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import type { ComponentSpec } from "@/models/componentSpec";
import { getComponentFileFromList } from "@/utils/componentStore";
import { USER_PIPELINES_LIST_NAME } from "@/utils/constants";

export const MetadataBlock = withSuspenseWrapper(function MetadataBlock({
  spec,
}: {
  spec: ComponentSpec;
}) {
  const { data: fileMeta } = useSuspenseQuery({
    queryKey: ["file-meta", spec.name],
    queryFn: () =>
      getComponentFileFromList(USER_PIPELINES_LIST_NAME, spec.name),
  });

  const metadata = fileMeta
    ? [
        {
          label: "Created by",
          value: fileMeta.componentRef.spec.metadata?.annotations?.author,
        },
        {
          label: "Created at",
          value: fileMeta.creationTime?.toLocaleString(),
        },
        {
          label: "Last updated",
          value: fileMeta.modificationTime?.toLocaleString(),
        },
      ]
    : [];

  return <KeyValueList title="Metadata" items={metadata} />;
});
