import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { TopBarAuthentication } from "@/components/shared/Authentication/TopBarAuthentication";
import BackendStatus from "@/components/shared/BackendStatus";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { ManageSecretsButton } from "@/components/shared/SecretsManagement/ManageSecretsButton";
import { PersonalPreferences } from "@/components/shared/Settings/PersonalPreferences";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { DOCUMENTATION_URL } from "@/utils/constants";

export function AppMenuActions() {
  const requiresAuthorization = isAuthorizationRequired();

  return (
    <InlineStack
      gap="2"
      wrap="nowrap"
      className="shrink-0"
      data-testid="app-menu-actions"
    >
      <BackendStatus />
      <PersonalPreferences />
      <ManageSecretsButton />
      <Link href={DOCUMENTATION_URL} target="_blank" rel="noopener noreferrer">
        <TooltipButton tooltip="Documentation">
          <Icon name="CircleQuestionMark" />
        </TooltipButton>
      </Link>
      {requiresAuthorization && <TopBarAuthentication />}
    </InlineStack>
  );
}
