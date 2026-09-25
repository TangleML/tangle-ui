import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Switch } from "@/components/ui/switch";
import { Paragraph } from "@/components/ui/typography";
import type { Flag } from "@/types/configuration";

interface SettingProps {
  setting: Flag;
  onChange?: (enabled: boolean) => void;
}

export function Setting({ setting, onChange }: SettingProps) {
  // A build that cannot support this flag still lets whoever already has it on
  // turn it off; locking it outright would strand them with no way back.
  const isLockedOff = setting.canEnable === false && !setting.enabled;

  return (
    <InlineStack gap="2" blockAlign="center" key={setting.name} wrap="nowrap">
      <Switch
        checked={setting.enabled}
        onCheckedChange={onChange}
        disabled={isLockedOff}
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
