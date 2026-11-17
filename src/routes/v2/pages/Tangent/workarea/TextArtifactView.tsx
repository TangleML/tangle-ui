import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { ResourceHeader } from "@/components/Project/ResourceHeader";
import { languageFor } from "@/components/shared/CodeViewer";
import CodeEditor from "@/components/shared/CodeViewer/CodeEditor";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { userQueryOptions } from "@/hooks/useUserDetails";
import { remoteEnvAuthToken } from "@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken";
import {
  type ArtifactFile,
  artifactFilename,
  fetchArtifactFile,
} from "@/routes/v2/pages/Tangent/services/artifactText";
import { tracking } from "@/utils/tracking";
import { downloadBlobAsFile } from "@/utils/URL";

import { WorkareaLoading, WorkareaMessage } from "./WorkareaPlaceholder";

interface TextArtifactViewProps {
  url: string;
  title: string;
}

export function TextArtifactView({ url, title }: TextArtifactViewProps) {
  const { data: user, isPending: isUserPending } = useQuery(userQueryOptions);
  const authToken = remoteEnvAuthToken(user?.id);
  const filename = artifactFilename(url);
  const file = useQuery({
    queryKey: ["tangent", "artifact-file", url],
    queryFn: () => fetchArtifactFile(url, authToken),
    enabled: !isUserPending,
  });

  const download = () => {
    if (!file.data) return;
    downloadBlobAsFile(file.data.blob, filename);
  };

  return (
    <BlockStack className="min-h-0 w-full flex-1">
      <ResourceHeader icon="FileCode" title={title}>
        <Button
          variant="ghost"
          size="xs"
          disabled={!file.data}
          onClick={download}
          {...tracking("projects.download_asset")}
        >
          <Icon name="Download" size="xs" />
          Download
        </Button>
      </ResourceHeader>

      <TextArtifactBody
        file={file}
        language={languageFor(filename)}
        title={title}
      />
    </BlockStack>
  );
}

interface TextArtifactBodyProps {
  file: UseQueryResult<ArtifactFile>;
  language: string;
  title: string;
}

function TextArtifactBody({ file, language, title }: TextArtifactBodyProps) {
  switch (file.status) {
    case "pending":
      return <WorkareaLoading />;
    case "error":
      return <WorkareaMessage>{file.error.message}</WorkareaMessage>;
    case "success":
      return (
        <div className="min-h-0 w-full flex-1">
          <CodeEditor
            value={file.data.text}
            language={language}
            readOnly
            options={{ ariaLabel: title }}
          />
        </div>
      );
  }
}
