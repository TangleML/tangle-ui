import { useCallback, useEffect } from "react";

import type { JWTPayload } from "@/components/shared/Authentication/types";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { HOURS } from "@/components/shared/ComponentEditor/constants";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Spinner } from "@/components/ui/spinner";
import { useUserDetails } from "@/hooks/useUserDetails";

import { HF_AUTH_ENABLED } from "./constants";

const NullSkeleton = () => {
  return null;
};

function useSyncAuthStorageWithUserDetails() {
  const authStorage = useAuthLocalStorage();
  const { data: user } = useUserDetails();

  useEffect(() => {
    if (user && !!user.id && user.permissions.includes("write")) {
      authStorage.setJWT({
        original_token: "authorized-by-huggingface-nonce",
        auth_provider: "huggingface",
        user_id: user.id,
        login: user.id,
        avatar_url: "",
        exp: Math.floor(Date.now() / 1000) + 24 * HOURS,
      } satisfies JWTPayload);
    } else {
      authStorage.clear();
    }
  }, [user]);
}

export const HuggingFaceAuthButton = HF_AUTH_ENABLED
  ? /**
     * To prevent unneeded requests and UI flickering, real component will be created only if build-flag is enabled
     */
    withSuspenseWrapper(() => {
      const { awaitAuthorization, isLoading, isAuthorized } =
        useAwaitAuthorization();

      const signIn = useCallback(async () => {
        await awaitAuthorization();
      }, [awaitAuthorization]);

      useSyncAuthStorageWithUserDetails();

      if (isAuthorized) {
        return null;
      }

      return (
        <>
          <TooltipButton
            onClick={signIn}
            disabled={isLoading}
            className="flex items-center gap-2 w-full"
            tooltip="Sign in with Hugging Face to submit runs"
          >
            {isLoading ? (
              <>
                <Spinner />
                Authenticating...
              </>
            ) : (
              <>Sign in with Hugging Face</>
            )}
          </TooltipButton>
        </>
      );
    }, NullSkeleton)
  : // Null component if build-flag is disabled
    NullSkeleton;
