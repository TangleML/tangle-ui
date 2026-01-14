import { useNavigate as useReactRouterNavigation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

type NavigateOptions = Parameters<
  ReturnType<typeof useReactRouterNavigation>
>[0];

type AdvancedNavigationOptions = NavigateOptions & {
  /**
   * Force the navigation target to open in a new tab.
   * Target will always open in a new tab when CMD (Mac) or CTRL (Windows/Linux) key is held.
   */
  newTab?: boolean;
};

export const useNavigate = () => {
  const navigate = useReactRouterNavigation();
  const isMetaKeyPressedRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control") {
        isMetaKeyPressedRef.current = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control") {
        isMetaKeyPressedRef.current = false;
      }
    };

    const handleBlur = () => {
      isMetaKeyPressedRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const handleNavigate = (options: AdvancedNavigationOptions) => {
    const { newTab, ...navigateOptions } = options;
    const shouldOpenNewTab = newTab || isMetaKeyPressedRef.current;

    if (shouldOpenNewTab) {
      const url =
        navigateOptions.href ??
        (typeof navigateOptions.to === "string" ? navigateOptions.to : null);
      if (url === null) {
        console.warn("useNavigate 'newTab' argument requires a string URL");
        return;
      }

      window.open(url, "_blank");
    } else {
      navigate(navigateOptions as NavigateOptions);
    }
  };

  return handleNavigate;
};
