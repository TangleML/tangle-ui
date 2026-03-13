import { useEffect, useState } from "react";

import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { KeyValueList } from "@/components/shared/ContextPanel/Blocks/KeyValueList";
import { CopyText } from "@/components/shared/CopyText/CopyText";
import { InfoBox } from "@/components/shared/InfoBox";
import { DEFAULT_BORDER_COLOR } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/utils";
import { ColorPicker } from "@/components/ui/color";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";

export interface ColorEditorValue {
  color: string;
  borderColor?: string;
}

interface ColorEditorProps {
  value: ColorEditorValue;
  onChange: (updates: Partial<ColorEditorValue>) => void;
  readOnly: boolean;
  hasTextContent: boolean;
}

export function ColorEditor({
  value,
  onChange,
  readOnly,
  hasTextContent,
}: ColorEditorProps) {
  const currentBorderColor = value.borderColor ?? DEFAULT_BORDER_COLOR;

  const [backgroundColor, setBackgroundColor] = useState(value.color);
  const [borderColor, setBorderColor] = useState(currentBorderColor);

  const isTransparent = backgroundColor === "transparent";
  const isBorderTransparent = borderColor === "transparent";

  const handleBackgroundColorChange = (newColor: string) => {
    setBackgroundColor(newColor);
    onChange({ color: newColor, borderColor });
  };

  const handleBorderColorChange = (newColor: string) => {
    setBorderColor(newColor);
    onChange({ color: backgroundColor, borderColor: newColor });
  };

  useEffect(() => {
    setBackgroundColor(value.color);
    setBorderColor(currentBorderColor);
  }, [value.color, value.borderColor]);

  if (readOnly) {
    return (
      <KeyValueList
        title="Color"
        items={[
          { label: "Background", value: value.color, copyable: true },
          ...(isTransparent
            ? [
                {
                  label: "Border",
                  value: value.borderColor,
                  copyable: true,
                },
              ]
            : []),
        ]}
      />
    );
  }

  return (
    <ContentBlock title="Color">
      <BlockStack gap="1">
        <InlineStack gap="4" blockAlign="center">
          <Paragraph size="xs">Background</Paragraph>
          <ColorPicker
            title="Background Color"
            color={backgroundColor}
            setColor={handleBackgroundColorChange}
          />
          <CopyText className="text-xs font-mono">{value.color}</CopyText>
        </InlineStack>

        {isTransparent && (
          <InlineStack gap="4" blockAlign="center">
            <Paragraph size="xs">Border</Paragraph>
            <ColorPicker
              title="Border Color"
              color={borderColor}
              setColor={handleBorderColorChange}
            />
            <CopyText className="text-xs font-mono">
              {currentBorderColor}
            </CopyText>
          </InlineStack>
        )}

        {isTransparent && isBorderTransparent && !hasTextContent && (
          <InfoBox title="Invisible Node" variant="warning">
            This sticky note has no visual context. Consider adding a border,
            background or text.
          </InfoBox>
        )}
      </BlockStack>
    </ContentBlock>
  );
}
