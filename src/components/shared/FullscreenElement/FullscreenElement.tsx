import {
  type PropsWithChildren,
  type RefObject,
  useEffect,
  useRef,
  useState,
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
  const [id] = useState(() => Math.random().toString(15).substring(2, 15));
  const containerElementRef = useRef<HTMLElement>(
    document.createElement("div"),
  );
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(
    null,
  );

  useEffect(() => {
    const container = containerElementRef.current;
    container.dataset.testid = "fullscreen-container";
    if (fullscreen) {
      container.className = cn(
        "fixed",
        "top-0",
        "left-0",
        "z-[2147483647]",
        "w-full",
        "h-full",
        "overflow-hidden",
        "pointer-events-auto",
      );
      document.body.appendChild(container);
    } else {
      container.className = cn("contents", "pointer-events-auto");

      if (defaultMountElement.current) {
        defaultMountElement.current.appendChild(container);
      }
    }

    setContainerElement(container);

    return () => {
      container.remove();
    };
  }, [fullscreen, defaultMountElement]);

  if (!containerElement) {
    return null;
  }

  return createPortal(<>{children}</>, containerElement, id);
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
