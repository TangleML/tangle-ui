import { observer } from "mobx-react-lite";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import { createTaskFromComponentRef } from "@/models/componentSpec/factories/taskFactory";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import {
  addTaskCommand,
  connectNodesCommand,
} from "@/services/collaboration/commands/createCommands";
import type { CollabCommand } from "@/services/collaboration/protocol";

type Verb = CollabCommand["type"];

interface FormState {
  taskId: string;
  name: string;
  x: string;
  y: string;
  portName: string;
  value: string;
  bindingId: string;
  sourceEntityId: string;
  sourcePortName: string;
  targetEntityId: string;
  targetPortName: string;
}

interface FieldSpec {
  key: keyof FormState;
  placeholder: string;
}

const VERB_FIELDS: Record<Verb, FieldSpec[]> = {
  addTask: [{ key: "name", placeholder: "task name (optional)" }],
  deleteTask: [{ key: "taskId", placeholder: "taskId" }],
  renameTask: [
    { key: "taskId", placeholder: "taskId" },
    { key: "name", placeholder: "new name" },
  ],
  setTaskPosition: [
    { key: "taskId", placeholder: "taskId" },
    { key: "x", placeholder: "x" },
    { key: "y", placeholder: "y" },
  ],
  setTaskArgument: [
    { key: "taskId", placeholder: "taskId" },
    { key: "portName", placeholder: "portName" },
    { key: "value", placeholder: "value" },
  ],
  connectNodes: [
    { key: "sourceEntityId", placeholder: "source entityId" },
    { key: "sourcePortName", placeholder: "source portName" },
    { key: "targetEntityId", placeholder: "target entityId" },
    { key: "targetPortName", placeholder: "target portName" },
  ],
  deleteEdge: [{ key: "bindingId", placeholder: "bindingId" }],
};

const VERBS = Object.keys(VERB_FIELDS);

const EMPTY_FORM: FormState = {
  taskId: "",
  name: "",
  x: "0",
  y: "0",
  portName: "",
  value: "",
  bindingId: "",
  sourceEntityId: "",
  sourcePortName: "",
  targetEntityId: "",
  targetPortName: "",
};

function buildDebugTask(name: string) {
  const taskName = name.trim() || "Debug Task";
  return createTaskFromComponentRef(
    new IncrementingIdGenerator(),
    {
      name: taskName,
      spec: {
        name: taskName,
        inputs: [],
        outputs: [],
        implementation: { container: { image: "alpine" } },
      },
    },
    taskName,
  );
}

function buildCommand(verb: Verb, form: FormState): CollabCommand | null {
  switch (verb) {
    case "addTask":
      return addTaskCommand(buildDebugTask(form.name));
    case "deleteTask":
      return form.taskId ? { type: "deleteTask", taskId: form.taskId } : null;
    case "renameTask":
      return form.taskId && form.name
        ? { type: "renameTask", taskId: form.taskId, name: form.name }
        : null;
    case "setTaskPosition":
      return form.taskId
        ? {
            type: "setTaskPosition",
            taskId: form.taskId,
            position: { x: Number(form.x) || 0, y: Number(form.y) || 0 },
          }
        : null;
    case "setTaskArgument":
      return form.taskId && form.portName
        ? {
            type: "setTaskArgument",
            taskId: form.taskId,
            portName: form.portName,
            value: form.value,
          }
        : null;
    case "connectNodes":
      return form.sourceEntityId &&
        form.sourcePortName &&
        form.targetEntityId &&
        form.targetPortName
        ? connectNodesCommand(
            { entityId: form.sourceEntityId, portName: form.sourcePortName },
            { entityId: form.targetEntityId, portName: form.targetPortName },
          )
        : null;
    case "deleteEdge":
      return form.bindingId
        ? { type: "deleteEdge", bindingId: form.bindingId }
        : null;
  }
}

export const CollabDebugContent = observer(function CollabDebugContent() {
  const { collaboration } = useEditorSession();
  const [verb, setVerb] = useState<Verb>("addTask");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const setField = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSend = () => {
    const command = buildCommand(verb, form);
    if (command) collaboration.dispatch(command);
  };

  return (
    <BlockStack gap="4" className="p-3 overflow-y-auto h-full">
      <BlockStack gap="1">
        <StatRow label="Connection" value={collaboration.connectionState} />
        <StatRow label="Actor" value={collaboration.actorId ?? "—"} />
        <StatRow label="Version" value={String(collaboration.version)} />
        <StatRow label="Pending" value={String(collaboration.pending.length)} />
      </BlockStack>

      <BlockStack gap="2">
        <Text as="h3" size="sm" weight="semibold">
          Send command
        </Text>
        <select
          value={verb}
          onChange={(e) => setVerb(verbFromString(e.target.value))}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          {VERBS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <CommandFields verb={verb} form={form} setField={setField} />
        <Button size="sm" onClick={handleSend}>
          Send
        </Button>
      </BlockStack>

      <CommandLog
        title="Log"
        entries={collaboration.log.map(
          (entry) =>
            `v${entry.version} [${shortId(entry.actorId)}] ${entry.command.type}`,
        )}
      />
      <CommandLog
        title="Pending"
        entries={collaboration.pending.map((command) => command.type)}
      />
      <CommandLog
        title="Dropped"
        entries={collaboration.dropped.map((command) => command.type)}
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

function isVerb(value: string): value is Verb {
  return value in VERB_FIELDS;
}

function verbFromString(value: string): Verb {
  return isVerb(value) ? value : "addTask";
}

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

function CommandFields({
  verb,
  form,
  setField,
}: {
  verb: Verb;
  form: FormState;
  setField: (key: keyof FormState, value: string) => void;
}) {
  return (
    <BlockStack gap="2">
      {VERB_FIELDS[verb].map((field) => (
        <Input
          key={field.key}
          value={form[field.key]}
          placeholder={field.placeholder}
          onChange={(e) => setField(field.key, e.target.value)}
        />
      ))}
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
