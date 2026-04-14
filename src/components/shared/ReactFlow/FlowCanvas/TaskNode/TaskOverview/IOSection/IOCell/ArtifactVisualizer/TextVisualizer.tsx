import { useState } from "react";

import CodeEditor from "@/components/shared/CodeViewer/CodeEditor";
import { InlineStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Paragraph } from "@/components/ui/typography";
import {
  detectLanguage,
  isLanguageOption,
  LANGUAGE_OPTIONS,
} from "@/utils/detectLanguage";

import { useArtifactFetch } from "./useArtifactFetch";

interface TextVisualizerValueProps {
  value: string;
  isFullscreen?: boolean;
}

interface TextVisualizerRemoteProps {
  signedUrl: string;
  isFullscreen?: boolean;
}

const TextContent = ({
  content,
  isFullscreen,
}: {
  content: string;
  isFullscreen?: boolean;
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState(() =>
    detectLanguage(content),
  );

  if (content.length === 0) {
    return (
      <Paragraph tone="subdued" size="xs">
        No data
      </Paragraph>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      <InlineStack>
        <Select
          value={selectedLanguage}
          onValueChange={(v) => {
            if (isLanguageOption(v)) setSelectedLanguage(v);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InlineStack>
      <div className={isFullscreen ? "flex-1 min-h-0" : "h-64"}>
        <CodeEditor value={content} language={selectedLanguage} readOnly />
      </div>
    </div>
  );
};

export const TextVisualizerValue = ({
  value,
  isFullscreen,
}: TextVisualizerValueProps) => (
  <TextContent content={value} isFullscreen={isFullscreen} />
);

export const TextVisualizerRemote = ({
  signedUrl,
  isFullscreen,
}: TextVisualizerRemoteProps) => {
  const content = useArtifactFetch("text", signedUrl, (r) => r.text());
  return <TextContent content={content} isFullscreen={isFullscreen} />;
};
