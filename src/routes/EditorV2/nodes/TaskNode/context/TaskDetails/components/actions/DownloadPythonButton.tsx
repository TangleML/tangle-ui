import { FaPython } from "react-icons/fa";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";
import { downloadStringAsFile } from "@/utils/URL";

interface DownloadPythonButtonProps {
  pythonCode: string;
  fileName: string;
}

export const DownloadPythonButton = ({
  pythonCode,
  fileName,
}: DownloadPythonButtonProps) => {
  const handleClick = () => {
    downloadStringAsFile(pythonCode, fileName, "text/x-python");
  };

  return (
    <ActionButton tooltip="Download Python Code" onClick={handleClick}>
      <FaPython />
    </ActionButton>
  );
};
