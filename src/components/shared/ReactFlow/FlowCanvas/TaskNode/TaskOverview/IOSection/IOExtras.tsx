import type { GetExecutionArtifactsResponse } from "@/api/types.gen";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { Heading, Paragraph } from "@/components/ui/typography";
import type { InputSpec, OutputSpec } from "@/utils/componentSpec";
import { formatBytes } from "@/utils/string";
import { convertArtifactUriToHTTPUrl } from "@/utils/URL";

interface IOExtrasProps {
  inputs?: InputSpec[];
  outputs?: OutputSpec[];
  artifacts: GetExecutionArtifactsResponse;
}

const IOExtras = ({ inputs, outputs, artifacts }: IOExtrasProps) => {
  const additionalInputs = Object.entries(
    artifacts.input_artifacts || {},
  ).filter(([key]) => !inputs?.some((input) => input.name === key));

  const additionalOutputs = Object.entries(
    artifacts.output_artifacts || {},
  ).filter(([key]) => !outputs?.some((output) => output.name === key));

  const hasAdditionalInputs = additionalInputs.length > 0;
  const hasAdditionalOutputs = additionalOutputs.length > 0;

  if (!hasAdditionalInputs && !hasAdditionalOutputs) {
    return null;
  }
  return (
    <>
      {hasAdditionalInputs && (
        <BlockStack gap="1" className="w-full">
          <Heading level={1}>Additional Input Artifacts</Heading>
          <div className="border rounded-md divide-y">
            {additionalInputs.map(([key, artifact]) => (
              <BlockStack key={key} className="px-3 py-2">
                <BlockStack align="center">
                  <Paragraph>{key}</Paragraph>
                  {artifact.type_name && (
                    <Paragraph
                      tone="subdued"
                      size="xs"
                      className="ml-1.5 bg-gray-100 px-1 py-0.5 rounded"
                    >
                      Type: {artifact.type_name}
                    </Paragraph>
                  )}
                </BlockStack>

                {artifact.artifact_data && (
                  <BlockStack gap="1">
                    {artifact.artifact_data.value !== undefined && (
                      <InlineStack gap="1">
                        <Paragraph tone="subdued" size="xs" className="w-14">
                          Value:
                        </Paragraph>
                        <Paragraph font="mono">
                          {JSON.stringify(artifact.artifact_data.value)}
                        </Paragraph>
                      </InlineStack>
                    )}

                    {artifact.artifact_data.uri && (
                      <InlineStack gap="1">
                        <Paragraph tone="subdued" size="xs" className="w-14">
                          URI:
                        </Paragraph>
                        <Link
                          href={convertArtifactUriToHTTPUrl(
                            artifact.artifact_data.uri,
                            artifact.artifact_data.is_dir,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Paragraph font="mono" size="xs">
                            {artifact.artifact_data.uri}
                          </Paragraph>
                        </Link>
                      </InlineStack>
                    )}

                    {artifact.artifact_data.total_size && (
                      <InlineStack gap="1">
                        <Paragraph tone="subdued" size="xs" className="w-14">
                          Size:
                        </Paragraph>
                        <Paragraph font="mono" size="xs">
                          {formatBytes(artifact.artifact_data.total_size)}
                        </Paragraph>
                      </InlineStack>
                    )}
                  </BlockStack>
                )}
              </BlockStack>
            ))}
          </div>
        </BlockStack>
      )}

      {hasAdditionalOutputs && (
        <BlockStack gap="1" className="w-full">
          <Heading level={1}>Additional Output Artifacts</Heading>
          <div className="border rounded-md divide-y">
            {additionalOutputs.map(([key, artifact]) => (
              <BlockStack key={key} className="px-3 py-2">
                <BlockStack align="center">
                  <Paragraph>{key}</Paragraph>
                  {artifact.type_name && (
                    <Paragraph
                      tone="subdued"
                      size="xs"
                      className="ml-1.5 bg-gray-100 px-1 py-0.5 rounded"
                    >
                      Type: {artifact.type_name}
                    </Paragraph>
                  )}
                </BlockStack>

                {artifact.artifact_data && (
                  <BlockStack gap="1">
                    {artifact.artifact_data.value !== undefined && (
                      <InlineStack gap="1">
                        <Paragraph tone="subdued" size="xs" className="w-14">
                          Value:
                        </Paragraph>
                        <Paragraph font="mono">
                          {JSON.stringify(artifact.artifact_data.value)}
                        </Paragraph>
                      </InlineStack>
                    )}

                    {artifact.artifact_data.uri && (
                      <InlineStack gap="1">
                        <Paragraph tone="subdued" size="xs" className="w-14">
                          URI:
                        </Paragraph>
                        <Link
                          href={convertArtifactUriToHTTPUrl(
                            artifact.artifact_data.uri,
                            artifact.artifact_data.is_dir,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Paragraph font="mono" size="xs">
                            {artifact.artifact_data.uri}
                          </Paragraph>
                        </Link>
                      </InlineStack>
                    )}

                    {artifact.artifact_data.total_size && (
                      <InlineStack gap="1">
                        <Paragraph tone="subdued" size="xs" className="w-14">
                          Size:
                        </Paragraph>
                        <Paragraph font="mono" size="xs">
                          {formatBytes(artifact.artifact_data.total_size)}
                        </Paragraph>
                      </InlineStack>
                    )}

                    {artifact.artifact_data.is_dir && (
                      <InlineStack gap="1">
                        <Paragraph tone="subdued" size="xs" className="w-14">
                          Type:
                        </Paragraph>
                        <Paragraph font="mono" size="xs">
                          Directory
                        </Paragraph>
                      </InlineStack>
                    )}
                  </BlockStack>
                )}
              </BlockStack>
            ))}
          </div>
        </BlockStack>
      )}
    </>
  );
};

export default IOExtras;
