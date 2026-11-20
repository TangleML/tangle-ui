import { useId } from "react";

import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

export const AGENT_WRITES_LABEL = "Allow agents to write to this repository";
export const AGENT_WRITES_HELP =
  "Agents can open draft pull requests, create issues and post comments, each marked as written by an agent, and only after you confirm in the chat.";
export const PUBLIC_WRITES_WARNING =
  "Anything an agent pushes to a public repository is visible immediately.";

interface AgentWritesFieldProps {
  checked: boolean;
  isPublic: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function AgentWritesField({
  checked,
  isPublic,
  onCheckedChange,
}: AgentWritesFieldProps) {
  const switchId = useId();
  const helpId = useId();
  const warningId = useId();

  return (
    <BlockStack gap="2">
      <InlineStack gap="3" blockAlign="center" wrap="nowrap">
        <Switch
          id={switchId}
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-describedby={isPublic ? `${helpId} ${warningId}` : helpId}
          {...tracking("projects.link_repository_allow_writes", {
            new_value: !checked,
          })}
        />
        <Label htmlFor={switchId}>{AGENT_WRITES_LABEL}</Label>
      </InlineStack>
      <Text id={helpId} size="xs" tone="subdued">
        {AGENT_WRITES_HELP}
      </Text>
      {isPublic && (
        <Text id={warningId} size="xs" tone="warning">
          {PUBLIC_WRITES_WARNING}
        </Text>
      )}
    </BlockStack>
  );
}
