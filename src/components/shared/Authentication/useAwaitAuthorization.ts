import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";

import { useGitHubAuthPopup } from "@/components/shared/GitHubAuth/useGitHubAuthPopup";
import { useHuggingFaceAuthPopup } from "@/components/shared/HuggingFaceAuth/useHuggingFaceAuthPopup";
import useToastNotification from "@/hooks/useToastNotification";

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

/**
 * ad-hoc switch for different auth providers
 * assuming we allow only one auth provider at a time
 */
const GH_AUTH_ENABLED = !!import.meta.env.VITE_GITHUB_CLIENT_ID;
const useAuthorizationPopup = GH_AUTH_ENABLED
  ? useGitHubAuthPopup
  : useHuggingFaceAuthPopup;

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

  const isAuthorized = useMemo(
    () => !isAuthorizationRequired() || !!token,
    [token],
  );

  const onSuccess = useCallback(
    (response: OasisAuthResponse) => {
      notify(`Authorization successful!`, "success");

      const jwtPayload = convertJWTToJWTPayload(response.token);
      authStorage.setJWT(jwtPayload);
      promiseRef.current.resolve(response.token);
    },
    [authStorage, notify],
  );

  const onError = useCallback(
    (error: string) => {
      notify(`Authorization error: ${error}`, "error");
      authStorage.clear();
      promiseRef.current.reject(new Error(`Authorization failed: ${error}`));
    },
    [authStorage, notify],
  );

  const onClose = useCallback(() => {
    if (token) {
      promiseRef.current.resolve(token);
    } else {
      promiseRef.current.reject(new Error("Authorization required"));
    }
  }, [token]);

  const { openPopup, isLoading, isPopupOpen, closePopup, bringPopupToFront } =
    // todo: switch based on auth provider (github, minerva, huggingface)
    useAuthorizationPopup({
      onSuccess,
      onError,
      onClose,
    });

  const awaitAuthorization = useCallback(() => {
    promiseRef.current = createControlledPromise<string | undefined>();
    // entry point for durable authentication process
    openPopup();
    return promiseRef.current.promise;
  }, [openPopup]);

  return useMemo(
    () => ({
      isAuthorized,
      awaitAuthorization,
      isLoading,
      isPopupOpen,
      closePopup,
      bringPopupToFront,
    }),
    [
      awaitAuthorization,
      isAuthorized,
      isLoading,
      isPopupOpen,
      closePopup,
      bringPopupToFront,
    ],
  );
}
