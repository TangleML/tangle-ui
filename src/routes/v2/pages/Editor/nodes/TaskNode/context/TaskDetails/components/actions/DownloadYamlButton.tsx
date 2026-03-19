import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { downloadYamlFromComponentText } from "@/utils/URL";

interface DownloadYamlButtonProps {
  yamlText: string;
  taskName: string;
}

export const DownloadYamlButton = ({
  yamlText,
  taskName,
}: DownloadYamlButtonProps) => {
  const handleClick = () => {
    downloadYamlFromComponentText(yamlText, taskName);
  };

  return (
    <ActionButton
      tooltip="Download YAML"
      icon="Download"
      onClick={handleClick}
    />
  );
};
