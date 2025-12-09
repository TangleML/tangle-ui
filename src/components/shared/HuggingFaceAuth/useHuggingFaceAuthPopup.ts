import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { GetUserResponse } from "@/api/types.gen";
import type {
  JWTPayload,
  OasisAuthResponse,
} from "@/components/shared/Authentication/types";
import { HOURS } from "@/components/shared/ComponentEditor/constants";
import { API_URL } from "@/utils/constants";
import { getUserDetails } from "@/utils/user";

import { HUGGING_FACE_DEFAULT_JWT } from "./constants";

const POPUP_WIDTH = 600;
const POPUP_HEIGHT = 700;

function buildAuthUrl() {
  const authUrl = new URL(
    "/api/oauth/huggingface/login",
    !!API_URL && API_URL !== "" ? API_URL : window.location.origin,
  );

  // todo: build target url respecting router settings
  //   for HF realm it is ok to hardcode the target url style
  authUrl.searchParams.set("_target_url", "/#/authorize/huggingface");

  return authUrl.toString();
}

/**
 * todo: make generic for all auth providers
 */
interface HuggingFaceAuthFlowPopupOptions {
  onSuccess: (response: OasisAuthResponse) => void;
  onError: (error: string) => void;
  onClose?: () => void;
}

export function useHuggingFaceAuthPopup({
  onSuccess,
  onError,
  onClose,
}: HuggingFaceAuthFlowPopupOptions) {
  const queryClient = useQueryClient();

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const pollAuthorizationInfoIntervalRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null);

  const cleanup = useEffectEvent(() => {
    if (pollAuthorizationInfoIntervalRef.current) {
      clearInterval(pollAuthorizationInfoIntervalRef.current);
      pollAuthorizationInfoIntervalRef.current = null;
    }
  });

  const closePopup = () => {
    setIsLoading(false);

    cleanup();

    setIsPopupOpen(false);
    onClose?.();
  };

  const onErrorStateHandler = useEffectEvent((error: string) => {
    onError(error);
    closePopup();
  });

  const pollAuthorizationInfo = useEffectEvent(async () => {
    return queryClient
      .fetchQuery({ queryKey: ["user"], queryFn: getUserDetails, staleTime: 0 })
      .then((user) => {
        if (user && !!user.id && user.permissions.includes("write")) {
          onSuccess({
            token: createJWTToken(user),
            token_type: "JWT",
          });

          closePopup();

          return true;
        }
        return false;
      })
      .catch((error) => {
        onErrorStateHandler(error.message);
        return false;
      })
      .finally(() => {
        queryClient.invalidateQueries({ queryKey: ["user"] });
      });
  });

  /**
   * In Hugging Face auth flow, the App is embedded in an iframe, rendering it as 3rd party origin.
   * Because of the 3P partioning we CAN NOT:
   * - get popup window reference (so no focusing, no closing, no communication);
   * - use postMessage() communication between same-origin;
   * - use localStorage communication between same-origin;
   *
   * Therefore, we need to poll the authorization info from the API instead of using "message" based communication.
   */
  const openPopup = () => {
    // todo: prevent opening multiple popups
    setIsLoading(true);

    const { left, top } = centerPopupOnDocument();

    window.open(
      buildAuthUrl(),
      "huggingface-auth",
      `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},scrollbars=yes,resizable=yes`,
    );

    pollAuthorizationInfoIntervalRef.current = setInterval(async () => {
      await pollAuthorizationInfo();
    }, 1500);

    // todo: timeout if popup is not closed after 10 seconds

    setIsPopupOpen(true);
  };

  useEffect(() => {
    return () => cleanup();
  }, []);

  const bringPopupToFront = () => {
    // no-op
  };

  return {
    isPopupOpen,
    isLoading,
    openPopup,
    closePopup,
    bringPopupToFront,
  };
}

function centerPopupOnDocument() {
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  const left = (screenWidth - POPUP_WIDTH) / 2;
  const top = (screenHeight - POPUP_HEIGHT) / 2;

  return {
    left: Math.max(0, left),
    top: Math.max(0, top),
  };
}

function base64UrlEncode(obj: object): string {
  const json = JSON.stringify(obj);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/**
 * To keep compatibility with other auth providers, we need to create a JWT token for Hugging Face manually,
 *  since API does not support JWT tokens for Hugging Face.
 * @param user
 * @returns
 */
function createJWTToken(user: GetUserResponse) {
  const payload: JWTPayload = {
    ...HUGGING_FACE_DEFAULT_JWT,
    user_id: user.id,
    login: user.id,
    avatar_url: "",

    exp: Math.floor(Date.now() / 1000) + 24 * HOURS,
  };

  // Encode payload as an unsigned JWT token (header.payload).
  const header = {
    alg: "none",
    typ: "JWT",
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(payload);

  return `${encodedHeader}.${encodedPayload}.`;
}
