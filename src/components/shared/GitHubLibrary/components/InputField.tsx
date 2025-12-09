import { type ChangeEvent, type ReactNode, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface InputFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  hint?: ReactNode | string;
  validate: (value: string) => string[] | null;
  onChange: (value: string | null, error: string[] | null) => void;
}

export const InputField = ({
  id,
  label,
  placeholder,
  value,
  hint,
  validate,
  onChange,
}: InputFieldProps) => {
  const [inputValue, setInputValue] = useState(value);
  const [error, setError] = useState<string[] | null>(null);
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    setInputValue(value);

    const validationErrors = validate(value);
    setError(validationErrors);

    if (validationErrors && validationErrors.length > 0) {
      onChange(null, validationErrors);
    } else {
      onChange(value, null);
    }
  };

  return (
    <BlockStack gap="2">
      <Label htmlFor={id}>{label}</Label>
      <BlockStack gap="0">
        <Input
          id={id}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleChange}
          aria-invalid={!!error}
          aria-describedby={`${id}-hint`}
          className={cn(error && "aria-invalid:border-destructive")}
        />
        {!!error && error.length > 0 && (
          <Text size="xs" tone="critical">
            {error.join("\n")}
          </Text>
        )}
      </BlockStack>
      <div id={`${id}-hint`}>{hint}</div>
    </BlockStack>
  );
};
