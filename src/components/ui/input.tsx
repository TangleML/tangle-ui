import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import * as React from "react";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex w-full min-w-0 bg-transparent transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-input border aria-invalid:border-destructive shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] rounded-md aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        noBorder: "",
        readOnly:
          "text-gray-500 bg-gray-100 cursor-not-allowed border-input border shadow-xs rounded-md",
      },
      inputSize: {
        xs: "h-6 px-2 py-0.5 text-xs",
        sm: "h-8 px-2.5 py-1 text-sm",
        md: "h-9 px-3 py-1 text-base md:text-sm",
        lg: "h-10 px-4 py-2 text-base",
      },
      font: {
        default: "",
        mono: "!font-mono",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "md",
      font: "default",
    },
  },
);

type InputVariantProps = VariantProps<typeof inputVariants>;

interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">, InputVariantProps {
  onEnter?: () => void;
  onEscape?: () => void;
}

function Input({
  className,
  type,
  readOnly,
  variant = readOnly ? "readOnly" : "default",
  inputSize,
  font,
  onEnter,
  onEscape,
  onKeyDown,
  ...props
}: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant, inputSize, font }), className)}
      readOnly={readOnly}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) {
          e.preventDefault();
          e.stopPropagation();
          onEnter();
        } else if (e.key === "Escape" && onEscape) {
          e.preventDefault();
          e.stopPropagation();
          onEscape();
        }

        onKeyDown?.(e);
      }}
      {...props}
    />
  );
}

function InputGroup({
  className,
  prefixElement,
  suffixElement,
  children,
  ...props
}: ComponentProps<"div"> & {
  prefixElement?: ReactNode;
  suffixElement?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "h-8",
        "flex p-0 items-center gap-1 border-input border aria-invalid:border-destructive shadow-xs transition-[border,box-shadow,outline] rounded-md",
        "has-[input:focus-within]:outline-2 has-[input:focus-within]:-outline-offset-2 has-[input:focus-within]:outline-gray-400/50",
        className,
      )}
      {...props}
    >
      {prefixElement}
      {children}
      {suffixElement}
    </div>
  );
}

export { Input, InputGroup };
