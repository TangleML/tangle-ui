import { useQueryClient } from "@tanstack/react-query";
import { LogOutIcon } from "lucide-react";
import { useEffectEvent, useSyncExternalStore } from "react";

import { Spinner } from "@/components/ui/spinner";

import TooltipButton from "../Buttons/TooltipButton";
import { Avatar } from "./Avatar";
import { useAuthLocalStorage } from "./useAuthLocalStorage";
import { useLogout } from "./useLogout";

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
        <Avatar profile={profile} />
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
