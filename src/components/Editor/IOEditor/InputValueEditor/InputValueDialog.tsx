import { MultilineTextInputDialog } from "@/components/shared/Dialogs/MultilineTextInputDialog";
import { Paragraph } from "@/components/ui/typography";
import { type InputSpec } from "@/utils/componentSpec";

export const InputValueDialog = ({
  input,
  value,
  placeholder,
  open,
  onCancel,
  onConfirm,
}: {
  input: InputSpec;
  placeholder?: string;
  value?: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) => {
  const titleMarkup = (
    <>
      {input.name}{" "}
      <Paragraph tone="subdued" size="xs" className="ml-1">
        ({input.type?.toString() ?? "any"})
      </Paragraph>
    </>
  );

  const description =
    input.description || "Enter the default value for this input.";

  return (
    <MultilineTextInputDialog
      title={titleMarkup}
      description={description}
      placeholder={placeholder}
      initialValue={value}
      open={open}
      onCancel={onCancel}
      onConfirm={onConfirm}
      highlightSyntax
    />
  );
};
