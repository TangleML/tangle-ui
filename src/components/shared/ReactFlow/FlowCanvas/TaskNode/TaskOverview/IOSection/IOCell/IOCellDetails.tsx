import type { ArtifactDataResponse } from "@/api/types.gen";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
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
        <InlineStack className="px-3 py-0 w-full">
          <span
            className="flex-1 w-full cursor-copy overflow-hidden"
            onClick={handleCopyValue}
          >
            <IOCodeViewer title={io.name} value={artifactData.value} />
          </span>
        </InlineStack>
      )}

      {artifactData.uri && (
        <InlineStack className="px-3 py-0">
          <span className="font-medium text-xs min-w-24 max-w-24">URI:</span>
          <Link
            external
            href={convertArtifactUriToHTTPUrl(
              artifactData.uri,
              artifactData.is_dir,
            )}
            className="font-mono break-all text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
          >
            {artifactData.uri}
          </Link>
        </InlineStack>
      )}
    </BlockStack>
  );
};

export default IOCellDetails;
