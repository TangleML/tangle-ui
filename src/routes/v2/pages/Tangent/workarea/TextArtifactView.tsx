import { useQuery } from "@tanstack/react-query";

import { languageFor } from "@/components/shared/CodeViewer";
import CodeEditor from "@/components/shared/CodeViewer/CodeEditor";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useRemoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import {
  artifactFilename,
  fetchArtifactText,
} from "@/routes/v2/pages/Tangent/services/artifactText";
import { tracking } from "@/utils/tracking";
import { downloadStringAsFile } from "@/utils/URL";

interface TextArtifactViewProps {
  url: string;
  title: string;
}

export function TextArtifactView({ url, title }: TextArtifactViewProps) {
  const authToken = useRemoteEnvAuthToken();
  const filename = artifactFilename(url);
  const {
    data: content,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["tangent", "artifact-text", url],
    queryFn: () => fetchArtifactText(url, authToken),
  });

  const download = () => {
    if (content === undefined) return;
    downloadStringAsFile(content, filename, "text/plain");
  };

  return (
    <BlockStack className="min-h-0 w-full flex-1">
      <InlineStack
        gap="2"
        wrap="nowrap"
        className="w-full shrink-0 border-b border-border px-3 py-1.5"
      >
        <Icon
          name="FileCode"
          size="xs"
          className="shrink-0 text-muted-foreground"
        />
        <Text size="sm" weight="medium" className="truncate">
          {title}
        </Text>
        <Button
          variant="ghost"
          size="xs"
          className="ml-auto shrink-0"
          disabled={content === undefined}
          onClick={download}
          {...tracking("projects.download_asset")}
        >
          <Icon name="Download" size="xs" />
          Download
        </Button>
      </InlineStack>

      <TextArtifactBody
        content={content}
        isPending={isPending}
        error={isError ? error : null}
        language={languageFor(filename)}
        title={title}
      />
    </BlockStack>
  );
}

interface TextArtifactBodyProps {
  content: string | undefined;
  isPending: boolean;
  error: Error | null;
  language: string;
  title: string;
}

function TextArtifactBody({
  content,
  isPending,
  error,
  language,
  title,
}: TextArtifactBodyProps) {
  if (isPending) {
    return (
      <BlockStack
        gap="1"
        align="center"
        className="min-h-0 flex-1 justify-center p-6"
      >
        <Spinner />
      </BlockStack>
    );
  }

  if (error || content === undefined) {
    return (
      <BlockStack
        gap="1"
        align="center"
        className="min-h-0 flex-1 justify-center p-6 text-center"
      >
        <Text size="sm" tone="subdued">
          {error?.message ?? "This file could not be loaded."}
        </Text>
      </BlockStack>
    );
  }

  return (
    <div className="min-h-0 w-full flex-1">
      <CodeEditor
        value={content}
        language={language}
        readOnly
        options={{ ariaLabel: title }}
      />
    </div>
  );
}
