import useToastNotification from "@/hooks/useToastNotification";
import type { HydratedComponentReference } from "@/utils/componentSpec";

import { ActionButton } from "../../Buttons/ActionButton";

interface CopyYamlButtonProps {
  componentRef: HydratedComponentReference;
}

export const CopyYamlButton = ({ componentRef }: CopyYamlButtonProps) => {
  const notify = useToastNotification();

  const handleClick = () => {
    const code = componentRef.text;

    navigator.clipboard.writeText(code).then(
      () => notify("YAML copied to clipboard", "success"),
      (err) => notify("Failed to copy YAML: " + err, "error"),
    );
  };

  return (
    <ActionButton label="Copy YAML" icon="Clipboard" onClick={handleClick} />
  );
};
