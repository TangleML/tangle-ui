import { observer } from "mobx-react-lite";

import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import type {
  CollabCommand,
  ParticipantInfo,
} from "@/services/collaboration/protocol";

function summarizeCommand(command: CollabCommand): string {
  return command.kind === "action"
    ? command.call.actionName
    : `patches:${command.label}`;
}

export const CollabDebugContent = observer(function CollabDebugContent() {
  const { collaboration } = useEditorSession();

  return (
    <BlockStack gap="4" className="p-3 overflow-y-auto h-full">
      <BlockStack gap="1">
        <StatRow label="Connection" value={collaboration.connectionState} />
        <StatRow label="Actor" value={collaboration.actorId ?? "—"} />
        <StatRow label="Version" value={String(collaboration.version)} />
        <StatRow label="Pending" value={String(collaboration.pending.length)} />
      </BlockStack>

      <ActorList
        actors={collaboration.participants}
        actorId={collaboration.actorId}
      />

      <CommandLog
        title="Log"
        entries={collaboration.log.map(
          (entry) =>
            `v${entry.version} [${shortId(entry.actorId)}] ${summarizeCommand(entry.command)}`,
        )}
      />
      <CommandLog
        title="Pending"
        entries={collaboration.pending.map(summarizeCommand)}
      />
      <CommandLog
        title="Dropped"
        entries={collaboration.dropped.map(summarizeCommand)}
      />
      <CommandLog
        title="Rejects"
        entries={collaboration.rejects.map(
          (reject) => `${reject.seq ?? "—"}: ${reject.reason}`,
        )}
      />
    </BlockStack>
  );
});

function shortId(id: string): string {
  return id.slice(0, 8);
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <InlineStack gap="2" blockAlign="center" align="space-between">
      <Text size="xs" tone="subdued">
        {label}
      </Text>
      <Text size="xs" font="mono">
        {value}
      </Text>
    </InlineStack>
  );
}

function ActorList({
  actors,
  actorId,
}: {
  actors: ParticipantInfo[];
  actorId: string | null;
}) {
  return (
    <BlockStack gap="1">
      <Text as="h3" size="xs" weight="semibold" tone="subdued">
        Actors ({actors.length})
      </Text>
      <BlockStack gap="1">
        {actors.map((actor) => (
          <InlineStack key={actor.actorId} gap="2" blockAlign="center">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: actor.color }}
            />
            <Text size="xs" font="mono">
              {shortId(actor.actorId)}
              {actor.actorId === actorId ? " (you)" : ""}
            </Text>
          </InlineStack>
        ))}
      </BlockStack>
    </BlockStack>
  );
}

function CommandLog({ title, entries }: { title: string; entries: string[] }) {
  return (
    <BlockStack gap="1">
      <Text as="h3" size="xs" weight="semibold" tone="subdued">
        {title} ({entries.length})
      </Text>
      <BlockStack gap="0">
        {entries.map((entry, index) => (
          <Text
            key={`${entry}-${index}`}
            size="xs"
            font="mono"
            className="truncate"
          >
            {entry}
          </Text>
        ))}
      </BlockStack>
    </BlockStack>
  );
}
