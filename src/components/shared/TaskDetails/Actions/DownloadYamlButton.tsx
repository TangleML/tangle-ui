import type { HydratedComponentReference } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";
import { downloadYamlFromComponentText } from "@/utils/URL";

import { ActionButton } from "../../Buttons/ActionButton";

interface DownloadYamlButtonProps {
  componentRef: HydratedComponentReference;
}

export const DownloadYamlButton = ({
  componentRef,
}: DownloadYamlButtonProps) => {
  const handleClick = () => {
    const displayName = getComponentName(componentRef);
    downloadYamlFromComponentText(componentRef.text, displayName);
  };

  return (
    <ActionButton label="Download YAML" icon="Download" onClick={handleClick} />
  );
};
