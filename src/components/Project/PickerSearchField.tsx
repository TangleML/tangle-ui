import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PickerSearchFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function PickerSearchField({
  label,
  value,
  onChange,
  className,
}: PickerSearchFieldProps) {
  return (
    <div className={cn("relative", className)}>
      <Icon
        name="Search"
        size="sm"
        className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onEscape={() => onChange("")}
        placeholder={label}
        aria-label={label}
        className="pl-7"
        autoFocus
      />
    </div>
  );
}
