import { useQueryClient } from "@tanstack/react-query";
import { useEffectEvent, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";

import { HuggingFaceAuthButton } from "../HuggingFaceAuth/HuggingFaceAuthButton";
import { Avatar } from "./Avatar";
import type { JWTPayload } from "./types";
import { useAuthLocalStorage } from "./useAuthLocalStorage";
import { useLogout } from "./useLogout";

export function TopBarAuthentication() {
  const localTokenStorage = useAuthLocalStorage();

  /**
   * This is a workaround to avoid the useSyncExternalStore from updating infinitely.
   *
   * `getToken` is used to trigger the useSyncExternalStore to update the profile.
   * Profile is parsed from the JSON in the local storage, resulting in a new object every time,
   *   which triggers the useSyncExternalStore to update infinitely.
   */
  useSyncExternalStore(localTokenStorage.subscribe, localTokenStorage.getToken);
  const profile = localTokenStorage.getJWT();

  return (
    <InlineStack>
      {profile ? <LoggedInDetails profile={profile} /> : <LoginButton />}
    </InlineStack>
  );
}

function LoginButton() {
  // todo: re-introduce GitHub auth provider
  return <HuggingFaceAuthButton />;
}

function LoggedInDetails({ profile }: { profile: JWTPayload }) {
  const localTokenStorage = useAuthLocalStorage();
  const queryClient = useQueryClient();

  const onLogoutSuccess = useEffectEvent(() => {
    queryClient.invalidateQueries({ queryKey: ["user"] });
    localTokenStorage.clear();
  });
  const { mutate: logout, isPending } = useLogout({
    onSuccess: onLogoutSuccess,
  });

  return (
    <Popover>
      <PopoverTrigger>
        <Avatar profile={profile} className="cursor-pointer" />
      </PopoverTrigger>

      <PopoverContent className="p-3">
        <BlockStack gap="2">
          <InlineStack gap="1">
            <Text>Logged in as</Text>
            <Text weight="semibold">{profile.login}</Text>
          </InlineStack>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => logout()}
            disabled={isPending}
          >
            <Text>Logout</Text>
            {isPending ? <Spinner /> : <Icon name="LogOut" />}
          </Button>
        </BlockStack>
      </PopoverContent>
    </Popover>
  );
}
