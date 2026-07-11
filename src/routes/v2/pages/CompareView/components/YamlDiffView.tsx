import { DiffEditor } from "@monaco-editor/react";

import type { ComponentSpec } from "@/utils/componentSpec";
import { componentSpecToText } from "@/utils/yaml";

interface YamlDiffViewProps {
  specA: ComponentSpec;
  specB: ComponentSpec;
}

export function YamlDiffView({ specA, specB }: YamlDiffViewProps) {
  const yamlA = componentSpecToText(specA);
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
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
      }}
    />
  );
}
