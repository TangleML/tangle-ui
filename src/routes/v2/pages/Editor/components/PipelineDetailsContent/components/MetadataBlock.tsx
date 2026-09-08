import { useSuspenseQuery } from "@tanstack/react-query";

import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import type { ComponentSpec } from "@/models/componentSpec";
import { findPipelineFile } from "@/services/pipelineStorage/pipelineOperations";

export const MetadataBlock = withSuspenseWrapper(function MetadataBlock({
  spec,
}: {
  spec: ComponentSpec;
}) {
  const { data: file } = useSuspenseQuery({
    queryKey: ["file-meta", spec.name],
    queryFn: () => findPipelineFile({ name: spec.name ?? "" }),
  });

  const author = spec.getMetadata("author");

  const metadata = file
    ? [
        {
          label: "Created by",
          value: author === undefined ? undefined : String(author),
        },
        {
          label: "Created at",
          value: file.createdAt?.toLocaleString(),
        },
        {
          label: "Last updated",
          value: file.modifiedAt?.toLocaleString(),
        },
      ]
    : [];

  return <KeyValueList title="Metadata" items={metadata} />;
});
