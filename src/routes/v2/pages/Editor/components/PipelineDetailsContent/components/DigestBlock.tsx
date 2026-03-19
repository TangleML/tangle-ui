import { useQuery } from "@tanstack/react-query";

import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { BlockStack } from "@/components/ui/layout";
import { generateDigest } from "@/utils/componentStore";

export const DigestBlock = withSuspenseWrapper(function DigestBlock({
  yamlText,
}: {
  yamlText: string;
}) {
  const { data: generatedDigest } = useQuery({
    queryKey: ["pipeline-digest", yamlText],
    staleTime: 0,
    queryFn: () => generateDigest(yamlText),
  });

  const digest = generatedDigest ?? "...";

  return (
    <ContentBlock title="Digest">
      <BlockStack className="bg-secondary p-2 rounded-md border truncate text-sm">
        <CopyText className="font-mono truncate">{digest}</CopyText>
      </BlockStack>
    </ContentBlock>
  );
});
