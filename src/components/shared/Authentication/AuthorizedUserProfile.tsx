import { LogOutIcon } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

import { Icon } from "@/components/ui/icon";

import TooltipButton from "../Buttons/TooltipButton";
import { useAuthLocalStorage } from "./useAuthLocalStorage";

export function AuthorizedUserProfile() {
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

  const handleLogout = useCallback(() => {
    localTokenStorage.clear();
  }, [localTokenStorage]);

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
        onClick={handleLogout}
        tooltip="Logout"
      >
        <LogOutIcon className="w-2 h-2" />
      </TooltipButton>
    </div>
  );
}
