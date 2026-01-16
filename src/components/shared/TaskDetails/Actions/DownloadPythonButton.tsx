import { FaPython } from "react-icons/fa";

import type { HydratedComponentReference } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";
import { downloadStringAsFile } from "@/utils/URL";

import { ActionButton } from "../../Buttons/ActionButton";

interface DownloadPythonButtonProps {
  componentRef: HydratedComponentReference;
}

export const DownloadPythonButton = ({
  componentRef,
}: DownloadPythonButtonProps) => {
  const handleClick = () => {
    const displayName = getComponentName(componentRef);
    const pythonOriginalCode =
      componentRef.spec.metadata?.annotations?.python_original_code;

    if (!pythonOriginalCode) return;

    downloadStringAsFile(
      pythonOriginalCode,
      `${componentRef.name || displayName}.py`,
      "text/x-python",
    );
  };

  return (
    <ActionButton label="Download Python Code" onClick={handleClick}>
      <FaPython />
    </ActionButton>
  );
};
