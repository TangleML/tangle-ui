import { useEffect, useState } from "react";

import { useAnchoredToast } from "../providers/AnchoredToastProvider";

interface Position {
  top: number;
  left: number;
}

export const AnchoredToastContainer = () => {
  const { toasts } = useAnchoredToast();
  const [positions, setPositions] = useState<Map<string, Position>>(new Map());

  useEffect(() => {
    const newPositions = new Map<string, Position>();

    toasts.forEach((toast) => {
      if (toast.anchorRef.current) {
        const rect = toast.anchorRef.current.getBoundingClientRect();
        newPositions.set(toast.id, {
          top: rect.top + window.scrollY,
          left: rect.left + rect.width / 2 + window.scrollX,
        });
      }
    });

    setPositions(newPositions);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <>
      {toasts.map((toast) => {
        const position = positions.get(toast.id);
        if (!position) return null;

        const anchorToasts = toasts.filter(
          (t) => t.anchorRef === toast.anchorRef,
        );
        const index = anchorToasts.findIndex((t) => t.id === toast.id);

        return (
          <div
            key={toast.id}
            className="fixed z-50 pointer-events-none"
            style={{
              top: position.top - 32,
              left: position.left,
              transform: "translateX(-50%)",
            }}
          >
            <div
              className="animate-out fade-out slide-out-to-top-2"
              style={{
                animationDuration: `${toast.duration}ms`,
                animationFillMode: "forwards",
                animationDelay: `${index * 50}ms`,
              }}
            >
              {toast.content}
            </div>
          </div>
        );
      })}
    </>
  );
};
