import { DiffEditor, Editor } from "@monaco-editor/react";

import { InfoBox } from "@/components/shared/InfoBox";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpec } from "@/utils/componentSpec";
import { componentSpecToText } from "@/utils/yaml";

interface YamlDiffViewProps {
  specA?: ComponentSpec;
  specB?: ComponentSpec;
  single?: boolean;
}

const SCROLLBAR = { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 };

export function YamlDiffView({ specA, specB, single }: YamlDiffViewProps) {
  if (!specA || !specB) {
    return (
      <InfoBox title="Nothing to compare" variant="info" width="full">
        Select two runs to compare their YAML specifications.
      </InfoBox>
    );
  }

  const yamlA = componentSpecToText(specA);

  if (single) {
    return (
      <InlineStack
        gap="0"
        blockAlign="stretch"
        wrap="nowrap"
        className="h-full w-full"
      >
        <div className="min-w-0 flex-1">
          <Editor
            value={yamlA}
            language="yaml"
            theme="vs-dark"
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: "on",
              scrollbar: SCROLLBAR,
            }}
          />
        </div>
        <InlineStack
          align="center"
          blockAlign="center"
          className="min-w-0 flex-1 border-l p-6"
        >
          <Text tone="subdued" className="text-center">
            Select a second run to compare YAML side by side.
          </Text>
        </InlineStack>
      </InlineStack>
    );
  }

  const yamlB = componentSpecToText(specB);

  return (
    <DiffEditor
      original={yamlA}
      modified={yamlB}
      language="yaml"
      theme="vs-dark"
      options={{
        readOnly: true,
        renderSideBySide: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "on",
        renderOverviewRuler: false,
        scrollbar: SCROLLBAR,
      }}
    />
  );
}
