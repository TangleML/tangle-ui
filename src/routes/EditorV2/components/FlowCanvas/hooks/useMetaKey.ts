import type { MutableRefObject } from "react";
import { useEffect, useRef, useState } from "react";

interface UseMetaKeyReturn {
  metaKeyPressed: boolean;
  metaKeyPressedRef: MutableRefObject<boolean>;
}

export function useMetaKey(): UseMetaKeyReturn {
  const [metaKeyPressed, setMetaKeyPressed] = useState(false);

  const metaKeyPressedRef = useRef(false);
  metaKeyPressedRef.current = metaKeyPressed;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control") {
        setMetaKeyPressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control") {
        setMetaKeyPressed(false);
      }
    };
    const onBlur = () => setMetaKeyPressed(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return { metaKeyPressed, metaKeyPressedRef };
}
