import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Switch } from "@/components/ui/switch";
import { Paragraph } from "@/components/ui/typography";
import type { Flag } from "@/types/configuration";

interface SettingProps {
  setting: Flag;
  onChange?: (enabled: boolean) => void;
}

export function Setting({ setting, onChange }: SettingProps) {
  return (
    <InlineStack gap="2" blockAlign="center" key={setting.name} wrap="nowrap">
      <Switch
        checked={setting.enabled}
        onCheckedChange={onChange}
        data-testid={`${setting.key}-switch`}
      />
      <BlockStack>
        <Paragraph>{setting.name}</Paragraph>
        <Paragraph size="sm" tone="subdued">
          {setting.description}
        </Paragraph>
      </BlockStack>
    </InlineStack>
  );
}
