import { Icon } from "@/components/ui/icon";

import TooltipButton from "../Buttons/TooltipButton";
import { ManageSecretsDialog } from "./ManageSecretsDialog";

export function ManageSecretsButton() {
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
