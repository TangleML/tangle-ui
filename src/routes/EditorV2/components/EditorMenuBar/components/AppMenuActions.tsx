import { Link as RouterLink } from "@tanstack/react-router";

import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { TopBarAuthentication } from "@/components/shared/Authentication/TopBarAuthentication";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
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
      <RouterLink to="/settings/backend">
        <TooltipButton tooltip="Settings">
          <Icon name="Settings" />
        </TooltipButton>
      </RouterLink>
      <Link href={DOCUMENTATION_URL} target="_blank" rel="noopener noreferrer">
        <TooltipButton tooltip="Documentation">
          <Icon name="CircleQuestionMark" />
        </TooltipButton>
      </Link>
      {requiresAuthorization && <TopBarAuthentication />}
    </InlineStack>
  );
}
