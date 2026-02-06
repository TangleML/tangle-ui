import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface SecretArgumentInputProps {
  secretName: string | null;
  isRemoved?: boolean;
  disabled?: boolean;
  onClear: () => void;
}

export const SecretArgumentInput = ({
  secretName,
  onClear,
  isRemoved = false,
  disabled = false,
}: SecretArgumentInputProps) => {
  return (
    <InlineStack
      gap="2"
      blockAlign="center"
      className={cn(
        "w-full px-3 py-1 rounded-md border ",
        isRemoved && "opacity-50",
      )}
    >
      <Icon name="Lock" size="sm" className="text-amber-600 shrink-0" />
      <Paragraph size="sm" className="truncate flex-1 text-amber-600">
        {secretName}
      </Paragraph>
      {!disabled && (
        <TooltipButton
          onClick={onClear}
          variant="ghost"
          size="xs"
          tooltip="Clear Secret"
          className="shrink-0"
        >
          <Icon name="X" size="sm" />
        </TooltipButton>
      )}
    </InlineStack>
  );
};
