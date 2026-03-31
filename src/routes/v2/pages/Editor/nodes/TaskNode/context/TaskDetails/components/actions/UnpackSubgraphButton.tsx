import { ActionButton } from "@/components/shared/Buttons/ActionButton";

interface UnpackSubgraphButtonProps {
  onUnpack: () => void;
}

export const UnpackSubgraphButton = ({
  onUnpack,
}: UnpackSubgraphButtonProps) => {
  return (
    <ActionButton
      tooltip="Unpack Subgraph"
      icon="PackageOpen"
      onClick={onUnpack}
    />
  );
};
