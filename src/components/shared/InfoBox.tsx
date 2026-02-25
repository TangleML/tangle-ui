import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface InfoBoxProps {
  title: string;
  width?: "full" | "fit" | "auto";
  className?: string;
  children: ReactNode;
  variant?: "info" | "error" | "warning" | "success" | "ghost";
}

const variantStyles: Record<
  NonNullable<InfoBoxProps["variant"]>,
  { container: string; title: string }
> = {
  info: {
    container: "border-blue-200 bg-blue-50",
    title: "text-blue-800",
  },
  error: {
    container: "border-red-200 bg-red-50",
    title: "text-red-800",
  },
  warning: {
    container: "border-yellow-200 bg-yellow-50",
    title: "text-yellow-800",
  },
  success: {
    container: "border-green-200 bg-green-50",
    title: "text-green-800",
  },
  ghost: {
    container: "border-gray-200 bg-none",
    title: "text-gray-800",
  },
};

const widthStyles: Record<NonNullable<InfoBoxProps["width"]>, string> = {
  full: "w-full",
  auto: "w-auto",
  fit: "w-fit",
};

export const InfoBox = ({
  title,
  width = "auto",
  className,
  children,
  variant = "info",
}: InfoBoxProps) => {
  const styles = variantStyles[variant];
  const widthClass = widthStyles[width];

  return (
    <div
      data-testid={`info-box-${variant}`}
      className={cn("border rounded-md p-2", styles.container, widthClass)}
    >
      <div
        data-testid="info-box-title"
        className={cn("text-sm font-semibold mb-1", styles.title)}
      >
        {title}
      </div>
      <div className={cn("text-sm", className)}>{children}</div>
    </div>
  );
};
