import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import useToastNotification from "@/hooks/useToastNotification";

interface CopyYamlButtonProps {
  yamlText: string;
}

export const CopyYamlButton = ({ yamlText }: CopyYamlButtonProps) => {
  const notify = useToastNotification();

  const handleClick = () => {
    navigator.clipboard.writeText(yamlText).then(
      () => notify("YAML copied to clipboard", "success"),
      (err) => notify("Failed to copy YAML: " + err, "error"),
    );
  };

  return (
    <ActionButton tooltip="Copy YAML" icon="Clipboard" onClick={handleClick} />
  );
};
