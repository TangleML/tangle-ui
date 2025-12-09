import { useEffect } from "react";

import type { JWTPayload } from "@/components/shared/Authentication/types";
import { useAuthLocalStorage } from "@/components/shared/Authentication/useAuthLocalStorage";
import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { HOURS } from "@/components/shared/ComponentEditor/constants";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Spinner } from "@/components/ui/spinner";
import { useUserDetails } from "@/hooks/useUserDetails";

import {
  HUGGING_FACE_DEFAULT_JWT,
  isHuggingFaceAuthEnabled,
} from "./constants";

const NullSkeleton = () => {
  return null;
};

function useSyncAuthStorageWithUserDetails() {
  const authStorage = useAuthLocalStorage();
  const { data: user } = useUserDetails();

  useEffect(() => {
    if (user && !!user.id && user.permissions.includes("write")) {
      authStorage.setJWT({
        ...HUGGING_FACE_DEFAULT_JWT,
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

const HuggingFaceAuthButtonComponent = withSuspenseWrapper(
  ({
    title,
    variant,
  }: {
    title?: string;
    variant?: "secondary" | "default" | "outline" | "ghost";
  }) => {
    const { awaitAuthorization, isLoading, isAuthorized } =
      useAwaitAuthorization();

    const signIn = async () => {
      await awaitAuthorization();
    };

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
          variant={variant}
        >
          {isLoading ? (
            <>
              <Spinner />
              Authenticating...
            </>
          ) : (
            <>{title}</>
          )}
        </TooltipButton>
      </>
    );
  },
  NullSkeleton,
);

export const HuggingFaceAuthButton = ({
  title = "Sign in",
  variant = "secondary",
}: {
  title?: string;
  variant?: "secondary" | "default" | "outline" | "ghost";
}) => {
  // Check at runtime to support testing
  if (!isHuggingFaceAuthEnabled()) {
    return <NullSkeleton />;
  }
  return <HuggingFaceAuthButtonComponent title={title} variant={variant} />;
};
