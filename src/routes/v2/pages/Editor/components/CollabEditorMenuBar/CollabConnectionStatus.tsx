import { observer } from "mobx-react-lite";

import { Badge } from "@/components/ui/badge";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import type { ConnectionState } from "@/services/collaboration/transport";

const CONNECTION_STATUS: Record<
  ConnectionState,
  { label: string; dotClassName: string }
> = {
  open: { label: "Connected", dotClassName: "bg-green-500" },
  connecting: { label: "Connecting", dotClassName: "bg-stone-400" },
  reconnecting: { label: "Reconnecting", dotClassName: "bg-amber-500" },
  closed: { label: "Disconnected", dotClassName: "bg-red-500" },
};

export const CollabConnectionStatus = observer(
  function CollabConnectionStatus() {
    const { collaboration } = useEditorSession();
    const status = CONNECTION_STATUS[collaboration.connectionState];

    return (
      <InlineStack gap="2" blockAlign="center" wrap="nowrap">
        <InlineStack gap="1" blockAlign="center" wrap="nowrap">
          <span
            className={cn("size-2 shrink-0 rounded-full", status.dotClassName)}
          />
          <Text as="span" size="xs" weight="medium" className="text-stone-300">
            {status.label}
          </Text>
        </InlineStack>
        <Badge size="sm" variant="secondary" shape="rounded">
          {collaboration.participants.length}
        </Badge>
      </InlineStack>
    );
  },
);
