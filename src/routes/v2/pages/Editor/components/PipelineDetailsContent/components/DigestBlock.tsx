import { useQuery } from "@tanstack/react-query";

import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
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
      <div className="bg-secondary p-2 rounded-md border">
        <CopyText size="xs" className="font-mono truncate">
          {digest}
        </CopyText>
      </div>
    </ContentBlock>
  );
});
