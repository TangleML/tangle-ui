import { ActionButton } from "../../Buttons/ActionButton";

interface UpgradeTaskButtonProps {
  onUpgrade: () => void;
}

export const UpgradeTaskButton = ({ onUpgrade }: UpgradeTaskButtonProps) => {
  return (
    <ActionButton
      tooltip="Update Task from Source URL"
      icon="CircleFadingArrowUp"
      onClick={onUpgrade}
    />
  );
};
