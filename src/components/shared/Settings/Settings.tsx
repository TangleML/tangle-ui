import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import type { Flag } from "@/types/configuration";

import { Setting } from "./Setting";

interface SettingsProps {
  settings: Flag[];
  onChange: (key: string, enabled: boolean) => void;
}

export function Settings({ settings, onChange }: SettingsProps) {
  return (
    <BlockStack gap="4">
      <Paragraph weight="semibold">Settings</Paragraph>
      {settings.length === 0 && <Paragraph>No settings available.</Paragraph>}
      {settings.map((setting) => (
        <Setting
          key={setting.key}
          setting={setting}
          onChange={(enabled) => onChange(setting.key, enabled)}
        />
      ))}
    </BlockStack>
  );
}
