import { useEffect, useRef, useState } from "react";

import type { OasisAuthResponse } from "@/components/shared/Authentication/types";
import { APP_ROUTES } from "@/routes/router";
import { API_URL } from "@/utils/constants";

const POPUP_WIDTH = 600;
const POPUP_HEIGHT = 700;

function buildAuthUrl() {
  const client_id = import.meta.env.VITE_GITHUB_CLIENT_ID;
  const redirect_uri = new URL("/authorize/github", window.location.origin);

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", client_id);
  authUrl.searchParams.set("redirect_uri", redirect_uri.toString());
  authUrl.searchParams.set("scope", "read:user");
  authUrl.searchParams.set("state", crypto.randomUUID());

  return authUrl.toString();
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

async function exchangeCodeForToken(code: string) {
  const state = crypto.randomUUID();
  const oauthExchangeRoute = "/api/auth/github/callback";

  const oasisUserUrl = new URL(
    `${API_URL}${oauthExchangeRoute}`,
    window.location.origin,
  );

  oasisUserUrl.searchParams.set("code", code);
  oasisUserUrl.searchParams.set("state", state);

  const response = await fetch(oasisUserUrl.toString());

  if (!response.ok) {
    throw new Error("Failed to exchange code for token");
  }

  return (await response.json()) as OasisAuthResponse;
}

interface GithubAuthFlowPopupOptions {
  onSuccess: (response: OasisAuthResponse) => void;
  onError: (error: string) => void;
  onClose?: () => void;
}

export function useGitHubAuthPopup({
  onSuccess,
  onError,
  onClose,
}: GithubAuthFlowPopupOptions) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const popupRef = useRef<Window | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const closePopup = () => {
    setIsLoading(false);

    if (popupRef.current) {
      popupRef.current.close();
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setIsPopupOpen(false);
    onClose?.();
  };

  const openPopup = () => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      return;
    }

    setIsLoading(true);

    const { left, top } = centerPopupOnDocument();

    const popupProxy = window.open(
      buildAuthUrl(),
      "github-auth",
      `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},scrollbars=yes,resizable=yes`,
    );

    if (!popupProxy) {
      onError(
        "Failed to open popup window. Please check your popup blocker settings.",
      );
      setIsLoading(false);
      return;
    }

    popupRef.current = popupProxy;
    setIsPopupOpen(true);

    popupProxy.focus();

    intervalRef.current = setInterval(() => {
      try {
        if (popupProxy.closed) {
          closePopup();
          return;
        }

        if (
          popupProxy.location.origin === window.location.origin &&
          popupProxy.location.href.includes(APP_ROUTES.GITHUB_AUTH_CALLBACK)
        ) {
          const urlParams = new URLSearchParams(popupProxy.location.search);
          const code = urlParams.get("code");
          const error = urlParams.get("error");

          if (error) {
            onError(error);
            closePopup();
            return;
          }

          if (code) {
            exchangeCodeForToken(code)
              .then((response) => {
                onSuccess(response);
                closePopup();
              })
              .catch((err) => {
                onError(err.message);
                closePopup();
              });
          }
        }
      } catch {
        // Cross-origin error is expected when popup is on GitHub domain
        // We'll continue monitoring until popup closes or returns to our domain
      }
    }, 1000);
  };

  const bringPopupToFront = () => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
    }
  };

  useEffect(() => {
    /**
     * Handle ESC key to close popup
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isPopupOpen) {
        closePopup();
      }
    };

    if (isPopupOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isPopupOpen, closePopup]);

  useEffect(() => {
    /**
     * Cleanup on unmount
     */
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    isPopupOpen,
    isLoading,
    openPopup,
    closePopup,
    bringPopupToFront,
  };
}
