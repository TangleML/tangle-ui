import { cva } from "class-variance-authority";
import { type AnchorHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

import { Icon } from "./icon";
import { InlineStack } from "./layout";

const linkVariants = cva("items-center inline-flex cursor-pointer", {
  variants: {
    variant: {
      primary: "text-primary hover:underline",
      disabled: "text-muted-foreground cursor-not-allowed pointer-events-none",
      classic: "text-sky-500 hover:text-sky-600 hover:underline",
      block: "text-inherit",
    },
    size: {
      xs: "text-xs",
      sm: "text-sm",
      md: "text-md",
      lg: "text-lg",
    },
  },
  defaultVariants: {
    variant: "classic",
    size: "md",
  },
});

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  external?: boolean;
  variant?: "primary" | "disabled" | "classic" | "block";
  size?: "xs" | "sm" | "md" | "lg";
}

function Link({
  external,
  children,
  className,
  download,
  variant,
  size,
  ...props
}: LinkProps) {
  const target = external || download ? "_blank" : undefined;
  const rel = external || download ? "noopener noreferrer" : undefined;

  return (
    <a
      target={target}
      rel={rel}
      download={download}
      {...props}
      className={cn(linkVariants({ variant, size }), className)}
    >
      <InlineStack gap="1" className="w-full">
        {children}
        {external && <Icon name="ExternalLink" size={size} />}
      </InlineStack>
    </a>
  );
}

export { Link };
