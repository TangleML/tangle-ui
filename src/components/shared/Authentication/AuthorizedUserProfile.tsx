import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOutIcon } from "lucide-react";
import { useEffectEvent, useSyncExternalStore } from "react";

import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { useBackend } from "@/providers/BackendProvider";

import TooltipButton from "../Buttons/TooltipButton";
import { HF_AUTH_ENABLED } from "../HuggingFaceAuth/constants";
import { useAuthLocalStorage } from "./useAuthLocalStorage";

function useLogout({
  onSuccess,
  onError,
}: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const { backendUrl } = useBackend();
  return useMutation({
    mutationFn: async () => {
      if (HF_AUTH_ENABLED) {
        await fetch(`${backendUrl}/api/oauth/huggingface/logout`, {
          method: "GET",
        });
      }
    },
    onSuccess: () => {
      onSuccess?.();
    },
    onError: (error) => {
      onError?.(error);
    },
  });
}

export function AuthorizedUserProfile() {
  const queryClient = useQueryClient();
  const localTokenStorage = useAuthLocalStorage();

  /**
   * This is a workaround to avoid the useSyncExternalStore from updating infinitely.
   *
   * `getToken` is used to trigger the useSyncExternalStore to update the profile.
   * Profile is parsed from the JSON in the local storage, resulting in a new object every time,
   *   which triggers the useSyncExternalStore to update infinitely.
   */
  const token = useSyncExternalStore(
    localTokenStorage.subscribe,
    localTokenStorage.getToken,
  );
  const profile = localTokenStorage.getJWT();

  const onLogoutSuccess = useEffectEvent(() => {
    queryClient.invalidateQueries({ queryKey: ["user"] });
    localTokenStorage.clear();
  });
  const { mutate: logout, isPending } = useLogout({
    onSuccess: onLogoutSuccess,
  });

  if (!token || !profile) {
    return null;
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={`${profile.login} avatar`}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to a default avatar if image fails to load
                e.currentTarget.src = `https://github.com/identicons/${profile.login}.png`;
              }}
            />
          ) : (
            <Icon name="User" size="fill" />
          )}
        </div>
        <span className="text-sm font-medium text-gray-700 truncate">
          {profile.login}
        </span>
      </div>

      <TooltipButton
        variant="ghost"
        size="icon"
        onClick={() => logout()}
        tooltip="Logout"
        disabled={isPending}
      >
        {isPending ? <Spinner /> : <LogOutIcon className="w-2 h-2" />}
      </TooltipButton>
    </div>
  );
}
