import { Icon } from "@/components/ui/icon";

import TooltipButton from "../Buttons/TooltipButton";
import { useFlagValue } from "../Settings/useFlags";
import { ManageSecretsDialog } from "./ManageSecretsDialog";

export function ManageSecretsButton() {
  const isSecretsEnabled = useFlagValue("secrets");

  if (!isSecretsEnabled) {
    return null;
  }

  return (
    <ManageSecretsDialog
      trigger={
        <TooltipButton
          tooltip="Manage Secrets"
          data-testid="manage-secrets-button"
        >
          <Icon name="Lock" />
        </TooltipButton>
      }
    />
  );
}
