import { Github } from "lucide-react";
import { useCallback } from "react";

import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import { Spinner } from "@/components/ui/spinner";

import TooltipButton from "../Buttons/TooltipButton";
import { GitHubAuthFlowBackdrop } from "./GitHubAuthFlowBackdrop";
import { isGitHubAuthEnabled } from "./helpers";

export function GitHubAuthButton() {
  const {
    awaitAuthorization,
    isPopupOpen,
    closePopup,
    bringPopupToFront,
    isLoading,
    isAuthorized,
  } = useAwaitAuthorization();

  const signIn = useCallback(async () => {
    await awaitAuthorization();
  }, [awaitAuthorization]);

  if (!isGitHubAuthEnabled() || isAuthorized) {
    return null;
  }

  return (
    <>
      <TooltipButton
        onClick={signIn}
        disabled={isLoading}
        className="flex items-center gap-2 w-full"
        tooltip="Sign in with GitHub to submit runs"
      >
        {isLoading ? (
          <>
            <Spinner />
            Authenticating...
          </>
        ) : (
          <>
            <Github className="w-4 h-4" />
            Sign in with GitHub
          </>
        )}
      </TooltipButton>

      <GitHubAuthFlowBackdrop
        isOpen={isPopupOpen}
        onClose={closePopup}
        onClick={bringPopupToFront}
      />
    </>
  );
}
