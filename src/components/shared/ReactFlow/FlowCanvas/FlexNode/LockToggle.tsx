import { type MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface LockToggleProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  locked: boolean;
  onToggleLock: () => void;
  showOnlyOnHover?: boolean;
  className?: string;
}

const LockToggle = ({
  size = "md",
  locked,
  onToggleLock,
  showOnlyOnHover = false,
  className,
}: LockToggleProps) => {
  const handleLockToggle = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onToggleLock();
  };

  const sizeClasses = {
    xs: "w-2! h-2!",
    sm: "w-3! h-3!",
    md: "w-4! h-4!",
    lg: "w-5! h-5!",
    xl: "w-6! h-6!",
  };

  return (
    <Button
      variant="ghost"
      size="min"
      onClick={handleLockToggle}
      className={cn(
        "opacity-60 hover:bg-transparent hover:opacity-100",
        !locked && showOnlyOnHover && "hidden group-hover:block hover:block",
        className,
      )}
    >
      <Icon
        name={locked ? "Lock" : "LockOpen"}
        className={cn(sizeClasses[size])}
      />
    </Button>
  );
};

export default LockToggle;
