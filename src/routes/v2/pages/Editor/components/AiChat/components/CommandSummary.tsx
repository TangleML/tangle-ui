import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { Command } from "@/routes/v2/pages/Editor/components/AiChat/aiChat.types";

import { EntityChip } from "./EntityChip";

interface CommandSummaryProps {
  commands: Command[];
}

const OP_LABELS: Record<string, string> = {
  addTask: "Added task",
  deleteTask: "Removed task",
  renameTask: "Renamed task",
  addInput: "Added input",
  deleteInput: "Removed input",
  renameInput: "Renamed input",
  addOutput: "Added output",
  deleteOutput: "Removed output",
  renameOutput: "Renamed output",
  connectNodes: "Connected",
  deleteEdge: "Disconnected",
  setTaskArgument: "Set argument",
  setName: "Renamed pipeline",
  setDescription: "Updated description",
  createSubgraph: "Created subgraph",
  unpackSubgraph: "Unpacked subgraph",
  createPythonComponent: "Created component",
};

function describeCommand(cmd: Command): {
  label: string;
  entityId?: string;
  entityLabel?: string;
} {
  const op = OP_LABELS[cmd.op] ?? cmd.op;
  const params = cmd.params;

  switch (cmd.op) {
    case "addTask":
      return {
        label: op,
        entityId: params.tempId as string | undefined,
        entityLabel: params.name as string | undefined,
      };
    case "deleteTask":
    case "renameTask":
      return {
        label: op,
        entityId: params.entityId as string | undefined,
        entityLabel: (params.newName ?? params.entityId) as string | undefined,
      };
    case "addInput":
    case "addOutput":
      return {
        label: op,
        entityId: params.tempId as string | undefined,
        entityLabel: params.name as string | undefined,
      };
    case "deleteInput":
    case "deleteOutput":
    case "renameInput":
    case "renameOutput":
      return {
        label: op,
        entityId: params.entityId as string | undefined,
        entityLabel: (params.newName ?? params.entityId) as string | undefined,
      };
    case "connectNodes": {
      const source = params.source as
        | { entityId: string; portName: string }
        | undefined;
      const target = params.target as
        | { entityId: string; portName: string }
        | undefined;
      return {
        label: `${op} ${source?.portName ?? "?"} → ${target?.portName ?? "?"}`,
        entityId: source?.entityId,
        entityLabel: source?.portName,
      };
    }
    case "setName":
      return { label: `${op} to "${params.name}"` };
    case "setDescription":
      return { label: op };
    case "setTaskArgument":
      return {
        label: `${op} "${params.inputName}"`,
        entityId: params.taskEntityId as string | undefined,
      };
    case "createSubgraph":
      return { label: `${op} "${params.subgraphName}"` };
    default:
      return { label: op };
  }
}

export function CommandSummary({ commands }: CommandSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (commands.length === 0) return null;

  const summary = `${commands.length} change${commands.length === 1 ? "" : "s"} applied`;

  return (
    <BlockStack gap="1" className="mt-1">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15 transition-colors cursor-pointer w-fit"
      >
        <Icon name="Zap" className="size-3" />
        {summary}
        <Icon
          name="ChevronDown"
          className={`size-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <BlockStack gap="1" className="pl-2 border-l-2 border-primary/20">
          {commands.map((cmd, i) => {
            const desc = describeCommand(cmd);
            return (
              <InlineStack
                key={i}
                gap="1"
                blockAlign="center"
                className="flex-wrap"
              >
                <Text size="xs" tone="subdued">
                  {desc.label}
                </Text>
                {desc.entityId && (
                  <EntityChip
                    entityId={desc.entityId}
                    label={desc.entityLabel ?? desc.entityId}
                  />
                )}
              </InlineStack>
            );
          })}
        </BlockStack>
      )}
    </BlockStack>
  );
}
