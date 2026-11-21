import { Text, useInput } from "ink";

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isActive?: boolean;
  placeholder?: string;
}

/**
 * A minimal single-line editor: printable characters append, Backspace deletes,
 * Enter submits. Enough for a chat composer and the prompts without pulling in a
 * full input widget.
 */
export function TextInput({
  value,
  onChange,
  onSubmit,
  isActive = true,
  placeholder = "",
}: TextInputProps) {
  useInput(
    (input, key) => {
      if (key.return) {
        onSubmit(value);
        return;
      }
      if (key.backspace || key.delete) {
        onChange(value.slice(0, -1));
        return;
      }
      if (key.ctrl || key.meta || key.upArrow || key.downArrow) return;
      if (key.leftArrow || key.rightArrow || key.tab) return;
      if (input) onChange(value + input);
    },
    { isActive },
  );

  if (!value) {
    return (
      <Text>
        <Text color="cyan">{"› "}</Text>
        <Text dimColor>{placeholder}</Text>
      </Text>
    );
  }

  return (
    <Text>
      <Text color="cyan">{"› "}</Text>
      {value}
      <Text inverse> </Text>
    </Text>
  );
}
