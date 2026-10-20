import { Icon } from "@/components/ui/icon";
import { Input, InputGroup } from "@/components/ui/input";

interface PickerSearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function PickerSearchField({
  label,
  value,
  onChange,
}: PickerSearchFieldProps) {
  return (
    <InputGroup
      className="w-full"
      prefixElement={
        <Icon
          name="Search"
          size="sm"
          className="ml-2 text-muted-foreground"
          aria-hidden="true"
        />
      }
    >
      <Input
        variant="noBorder"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onEscape={() => onChange("")}
        placeholder={label}
        aria-label={label}
        autoFocus
      />
    </InputGroup>
  );
}
