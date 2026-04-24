import {
  type PropsWithChildren,
  type RefObject,
  useEffect,
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
  const id = useRef(Math.random().toString(15).substring(2, 15));
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

  // When fullscreen, stop keyboard events from reaching document-level listeners
  // (e.g. ContextPanelProvider's Escape handler that would clear the panel and
  // unmount this component's parent).
  useEffect(() => {
    if (!fullscreen) return;
    const container = containerElementRef.current;
    const stopPropagation = (e: KeyboardEvent) => e.stopPropagation();
    container.addEventListener("keydown", stopPropagation);
    return () => container.removeEventListener("keydown", stopPropagation);
  }, [fullscreen]);

  return createPortal(<>{children}</>, containerElementRef.current, id.current);
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
