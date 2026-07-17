import { Link as RouterLink } from "@tanstack/react-router";

import { AiModelQuickSelect } from "@/components/layout/AiModelQuickSelect";
import { OnboardingNavPill } from "@/components/Onboarding/OnboardingNavPill";
import { isAuthorizationRequired } from "@/components/shared/Authentication/helpers";
import { TopBarAuthentication } from "@/components/shared/Authentication/TopBarAuthentication";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { EditorVersionToggle } from "@/components/shared/EditorVersionToggle";
import { RunVersionToggle } from "@/components/shared/RunVersionToggle";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Link } from "@/components/ui/link";
import { useTourMode } from "@/providers/TourProvider/TourModeContext";
import { openTourSettings } from "@/providers/TourProvider/TourSecretsDialog";
import { DOCUMENTATION_URL } from "@/utils/constants";
import { tracking } from "@/utils/tracking";

export function AppMenuActions() {
  const requiresAuthorization = isAuthorizationRequired();
  const tourMode = useTourMode();

  return (
    <InlineStack
      gap="2"
      wrap="nowrap"
      className="shrink-0"
      data-testid="app-menu-actions"
    >
      {!tourMode && <OnboardingNavPill />}
      <AiModelQuickSelect />
      <EditorVersionToggle showWelcomeSpotlight />
      <RunVersionToggle showWelcomeSpotlight />
      {tourMode ? (
        <TooltipButton
          tooltip="Settings"
          onClick={openTourSettings}
          variant="header"
          {...tracking("v2.header.settings")}
        >
          <Icon name="Settings" />
        </TooltipButton>
      ) : (
        <RouterLink to="/settings/backend">
          <TooltipButton
            tooltip="Settings"
            variant="header"
            {...tracking("v2.header.settings")}
          >
            <Icon name="Settings" />
          </TooltipButton>
        </RouterLink>
      )}
      <Link href={DOCUMENTATION_URL} target="_blank" rel="noopener noreferrer">
        <TooltipButton
          tooltip="Documentation"
          variant="header"
          {...tracking("v2.header.documentation")}
        >
          <Icon name="CircleQuestionMark" />
        </TooltipButton>
      </Link>
      {requiresAuthorization && <TopBarAuthentication />}
    </InlineStack>
  );
}
