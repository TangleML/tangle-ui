import { useRef, useSyncExternalStore } from "react";

import { useGitHubAuthPopup } from "@/components/shared/GitHubAuth/useGitHubAuthPopup";
import { useHuggingFaceAuthPopup } from "@/components/shared/HuggingFaceAuth/useHuggingFaceAuthPopup";
import useToastNotification from "@/hooks/useToastNotification";

import { isGitHubAuthEnabled } from "../GitHubAuth/helpers";
import { isHuggingFaceAuthEnabled } from "../HuggingFaceAuth/constants";
import { convertJWTToJWTPayload, isAuthorizationRequired } from "./helpers";
import type { OasisAuthResponse } from "./types";
import { useAuthLocalStorage } from "./useAuthLocalStorage";

function createControlledPromise<TReturn>() {
  let resolve: (value: TReturn) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};

  const promise = new Promise<TReturn>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

export function useAwaitAuthorization() {
  const notify = useToastNotification();
  const promiseRef = useRef<
    ReturnType<typeof createControlledPromise<string | undefined>>
  >(createControlledPromise<string | undefined>());

  const authStorage = useAuthLocalStorage();

  const token = useSyncExternalStore(
    authStorage.subscribe,
    authStorage.getToken,
  );

  const isAuthorized = !isAuthorizationRequired() || !!token;

  const onSuccess = (response: OasisAuthResponse) => {
    notify(`Authorization successful!`, "success");

    const jwtPayload = convertJWTToJWTPayload(response.token);
    authStorage.setJWT(jwtPayload);
    promiseRef.current.resolve(response.token);
  };

  const onError = (error: string) => {
    notify(`Authorization error: ${error}`, "error");
    authStorage.clear();
    promiseRef.current.reject(new Error(`Authorization failed: ${error}`));
  };

  const onClose = () => {
    if (token) {
      promiseRef.current.resolve(token);
    } else {
      promiseRef.current.reject(new Error("Authorization required"));
    }
  };

  const authPopupConfig = { onSuccess, onError, onClose };

  // Call all hooks unconditionally (React rules), then select the active one
  const huggingFacePopup = useHuggingFaceAuthPopup(authPopupConfig);
  const gitHubPopup = useGitHubAuthPopup(authPopupConfig);
  const noopPopup = useNoopAuthPopup(authPopupConfig);

  const getActivePopup = () => {
    if (isHuggingFaceAuthEnabled()) return huggingFacePopup;
    if (isGitHubAuthEnabled()) return gitHubPopup;
    return noopPopup;
  };

  const { openPopup, isLoading, isPopupOpen, closePopup, bringPopupToFront } =
    getActivePopup();

  const awaitAuthorization = () => {
    promiseRef.current = createControlledPromise<string | undefined>();
    openPopup();
    return promiseRef.current.promise;
  };

  return {
    isAuthorized,
    awaitAuthorization,
    isLoading,
    isPopupOpen,
    closePopup,
    bringPopupToFront,
  };
}

function useNoopAuthPopup({
  onError,
}: {
  onSuccess: (response: OasisAuthResponse) => void;
  onError: (error: string) => void;
  onClose?: () => void;
}) {
  return {
    isPopupOpen: false,
    isLoading: false,
    openPopup: () => {
      onError("No auth provider found");
    },
    closePopup: () => {
      onError("No auth provider found");
    },
    bringPopupToFront: () => {},
  };
}
