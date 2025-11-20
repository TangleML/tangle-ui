import {
  type PropsWithChildren,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

interface FullscreenElementProps extends PropsWithChildren {
  fullscreen: boolean;
  defaultMountElement: RefObject<HTMLElement | null>;
}

function FullscreenElementPortal({
  children,
  fullscreen,
  defaultMountElement,
}: FullscreenElementProps) {
  const id = useRef(crypto.randomUUID().toString());
  const containerElementRef = useRef<HTMLElement>(
    document.createElement("div"),
  );

  useEffect(() => {
    containerElementRef.current.dataset.testid = "fullscreen-container";
    if (fullscreen) {
      containerElementRef.current.className = cn(
        "fixed",
        "top-0",
        "left-0",
        "z-[2147483647]",
        "w-full",
        "h-full",
        "overflow-hidden",
        "pointer-events-auto",
      );
      document.body.appendChild(containerElementRef.current);
    } else {
      containerElementRef.current.className = cn(
        "contents",
        "pointer-events-auto",
      );

      if (defaultMountElement.current) {
        defaultMountElement.current.appendChild(containerElementRef.current);
      }
    }

    return () => {
      containerElementRef.current.remove();
    };
  }, [fullscreen, defaultMountElement]);

  const fragment = useMemo(() => <>{children}</>, [children]);

  return createPortal(fragment, containerElementRef.current, id.current);
}

export function FullscreenElement({
  children,
  fullscreen,
}: PropsWithChildren<{ fullscreen: boolean }>) {
  const mountRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div
        ref={mountRef}
        data-testid="fullscreen-element-mounting-point"
        style={{ display: "contents" }}
      />
      <FullscreenElementPortal
        fullscreen={fullscreen}
        defaultMountElement={mountRef}
      >
        {children}
      </FullscreenElementPortal>
    </>
  );
}
