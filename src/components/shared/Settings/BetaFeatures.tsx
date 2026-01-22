import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import type { Flag } from "@/types/configuration";

import { Setting } from "./Setting";

interface BetaFeaturesProps {
  betaFlags: Flag[];
  onChange: (key: string, enabled: boolean) => void;
}

export function BetaFeatures({ betaFlags, onChange }: BetaFeaturesProps) {
  return (
    <BlockStack gap="4">
      <Paragraph weight="semibold">Beta Features</Paragraph>
      {betaFlags.length === 0 && (
        <Paragraph>No beta features available.</Paragraph>
      )}
      {betaFlags.map((flag) => (
        <Setting
          key={flag.key}
          setting={flag}
          onChange={(enabled) => onChange(flag.key, enabled)}
        />
      ))}
    </BlockStack>
  );
}
