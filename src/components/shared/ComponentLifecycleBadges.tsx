import { Badge } from "@/components/ui/badge";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import {
  type ComponentLifecycleInfo,
  getComponentLifecycleInfo,
} from "@/services/componentLifecycle";
import type { ComponentReference } from "@/utils/componentSpec";

interface ComponentLifecycleBadgesProps {
  reference: ComponentReference;
}

function lifecycleLabel(lifecycle: ComponentLifecycleInfo): string {
  if (lifecycle.state === "superseded") return "Superseded";
  return "Deprecated";
}

export function ComponentLifecycleBadges({
  reference,
}: ComponentLifecycleBadgesProps) {
  const lifecycle = getComponentLifecycleInfo(reference);
  if (!lifecycle) return null;

  return (
    <InlineStack gap="1">
      <Badge
        variant={lifecycle.state === "superseded" ? "secondary" : "destructive"}
      >
        {lifecycleLabel(lifecycle)}
      </Badge>
      {lifecycle.replacementDigest && (
        <Badge
          variant="outline"
          title={`Replaced by ${lifecycle.replacementDigest}`}
        >
          Replaced by
          <Text as="span" font="mono">
            {lifecycle.replacementDigest}
          </Text>
        </Badge>
      )}
    </InlineStack>
  );
}
