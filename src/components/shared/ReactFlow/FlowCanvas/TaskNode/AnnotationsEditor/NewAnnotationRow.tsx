import { type FocusEvent, useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { InlineStack } from "@/components/ui/layout";

export type NewAnnotationRowData = {
  id: string;
  key: string;
  value: string;
};

interface NewAnnotationRowProps {
  row: NewAnnotationRowData;
  autofocus: boolean;
  onBlur: (row: NewAnnotationRowData) => void;
  onRemove: (row: NewAnnotationRowData) => void;
}

export const NewAnnotationRow = ({
  row,
  autofocus,
  onBlur,
  onRemove,
}: NewAnnotationRowProps) => {
  const [key, setKey] = useState(row.key);
  const [value, setValue] = useState(row.value);

  const newRow = useMemo(() => ({ ...row, key, value }), [row, key, value]);

  const handleRowBlur = useCallback(
    (e: FocusEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        onBlur(newRow);
      }
    },
    [newRow, onBlur],
  );

  const handleRowRemove = useCallback(() => {
    onRemove(newRow);
  }, [newRow, onRemove]);

  return (
    <div onBlur={handleRowBlur}>
      <InlineStack gap="2" className="mt-2">
        <Input
          placeholder="New annotation"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-39 ml-1"
          autoFocus={autofocus}
        />
        <Input
          placeholder="value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1"
        />
        <Button variant="ghost" size="icon" onClick={handleRowRemove}>
          <Icon name="Trash" className="text-destructive" />
        </Button>
      </InlineStack>
    </div>
  );
};
