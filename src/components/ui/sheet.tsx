import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  overlay = true,
  resizable = false,
  defaultSize = null,
  style,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  overlay?: boolean;
  resizable?: boolean;
  defaultSize?: number | null;
}) {
  const [size, setSize] = React.useState<number | null>(defaultSize);
  const [isResizing, setIsResizing] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!resizable) return;

    e.preventDefault();
    setIsResizing(true);

    const startPos =
      side === "left" || side === "right" ? e.clientX : e.clientY;
    const startSize =
      size ||
      (side === "left" || side === "right"
        ? contentRef.current?.offsetWidth
        : contentRef.current?.offsetHeight) ||
      0;

    const handleMouseMove = (e: MouseEvent) => {
      let newSize: number;

      if (side === "right") {
        newSize = startSize + (startPos - e.clientX);
      } else if (side === "left") {
        newSize = startSize + (e.clientX - startPos);
      } else if (side === "bottom") {
        newSize = startSize + (startPos - e.clientY);
      } else {
        newSize = startSize + (e.clientY - startPos);
      }

      const minSize = 256;
      const maxSize =
        side === "left" || side === "right"
          ? window.innerWidth * 0.8
          : window.innerHeight * 0.8;

      newSize = Math.max(minSize, Math.min(maxSize, newSize));

      setSize(newSize);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const resizeHandleClasses = cn(
    "absolute bg-transparent hover:bg-blue-500/20 transition-colors",
    {
      "top-0 bottom-0 w-1 cursor-col-resize":
        side === "left" || side === "right",
      "left-0 right-0 h-1 cursor-row-resize":
        side === "top" || side === "bottom",
      "right-0": side === "left",
      "left-0": side === "right",
      "bottom-0": side === "top",
      "top-0": side === "bottom",
    },
  );

  const sizeStyles = (() => {
    if (size === null) return {};

    if (side === "left" || side === "right") {
      return { width: `${size}px` };
    } else {
      return { height: `${size}px` };
    }
  })();

  return (
    <SheetPortal>
      {overlay && <SheetOverlay />}
      <SheetPrimitive.Content
        ref={contentRef}
        data-slot="sheet-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" &&
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full border-l" +
              (resizable || defaultSize ? "" : " w-3/4 sm:max-w-sm"),
          side === "left" &&
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full border-r" +
              (resizable || defaultSize ? "" : " w-3/4 sm:max-w-sm"),
          side === "top" &&
            "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 border-b" +
              (resizable || defaultSize ? "" : " h-auto"),
          side === "bottom" &&
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 border-t" +
              (resizable || defaultSize ? "" : " h-auto"),
          resizable && "select-none",
          isResizing && "cursor-col-resize",
          className,
        )}
        style={{ ...sizeStyles, ...style }}
        {...props}
      >
        {resizable && (
          <div
            className={resizeHandleClasses}
            onMouseDown={handleMouseDown}
            style={{ zIndex: 1000 }}
          />
        )}
        {children}
        <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
