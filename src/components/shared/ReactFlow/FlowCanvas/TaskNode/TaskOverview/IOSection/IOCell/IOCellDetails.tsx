import type { ArtifactDataResponse } from "@/api/types.gen";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/typography";
import type { InputSpec, OutputSpec } from "@/utils/componentSpec";
import { convertArtifactUriToHTTPUrl } from "@/utils/URL";

import type { IOCellActions } from "./IOCell";
import IOCodeViewer from "./IOCodeViewer";

interface IOCellDetailsProps {
  io: InputSpec | OutputSpec;
  artifactData: ArtifactDataResponse;
  actions: IOCellActions;
}

const IOCellDetails = ({ io, artifactData, actions }: IOCellDetailsProps) => {
  const { handleCopyValue } = actions;

  return (
    <BlockStack gap="3" className="pb-3 pt-5 border rounded-b-md bg-gray-50">
      {artifactData.value && (
        <InlineStack className="px-3 w-full">
          <span
            className="flex-1 w-full cursor-copy overflow-hidden"
            onClick={handleCopyValue}
          >
            <IOCodeViewer title={io.name} value={artifactData.value} />
          </span>
        </InlineStack>
      )}

      {artifactData.uri && (
        <InlineStack className="px-3">
          <Text size="xs">URI:</Text>
          <Link
            external
            href={convertArtifactUriToHTTPUrl(
              artifactData.uri,
              artifactData.is_dir,
            )}
            className="text-xs whitespace-pre-wrap break-all"
          >
            {artifactData.uri}
          </Link>
        </InlineStack>
      )}
    </BlockStack>
  );
};

export default IOCellDetails;
