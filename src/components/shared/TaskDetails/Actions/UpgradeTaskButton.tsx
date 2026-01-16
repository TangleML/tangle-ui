import { ActionButton } from "../../Buttons/ActionButton";

interface UpgradeTaskButtonProps {
  onUpgrade: () => void;
}

export const UpgradeTaskButton = ({ onUpgrade }: UpgradeTaskButtonProps) => {
  return (
    <ActionButton
      label="Update Task from Source URL"
      icon="CircleFadingArrowUp"
      onClick={onUpgrade}
    />
  );
};
