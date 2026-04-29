import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

interface CreateSubgraphFormProps {
  selectedTaskCount: number;
  onSubmit: (name: string) => void;
  autoFocus?: boolean;
}

export function CreateSubgraphForm({
  selectedTaskCount,
  onSubmit,
  autoFocus,
}: CreateSubgraphFormProps) {
  const defaultName = `Subgraph (${selectedTaskCount} tasks)`;
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    setName(`Subgraph (${selectedTaskCount} tasks)`);
  }, [selectedTaskCount]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim());
  };

  return (
    <BlockStack gap="3">
      <BlockStack gap="1">
        <Label className="text-gray-600">Create Subgraph</Label>
        <Text size="xs" className="text-gray-400">
          Group {selectedTaskCount} tasks into a reusable component
        </Text>
      </BlockStack>
      <BlockStack gap="2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Subgraph name..."
          className="text-sm"
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
        />
        <Button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="w-full gap-1.5"
          size="sm"
        >
          <Icon name="Layers" size="sm" />
          Create Subgraph
        </Button>
      </BlockStack>
    </BlockStack>
  );
}
