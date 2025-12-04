import { cva, type VariantProps } from "class-variance-authority";
import { icons } from "lucide-react";

import { cn } from "@/lib/utils";

const iconVariants = cva("", {
  variants: {
    size: {
      xs: "!w-3 !h-3",
      sm: "!w-3.5 !h-3.5",
      md: "!w-4 !h-4",
      lg: "!w-5 !h-5",
      fill: "!w-full !h-full",
    },
  },
});

export type IconName = keyof typeof icons;

interface IconProps extends VariantProps<typeof iconVariants> {
  name: IconName;
  className?: string;
}

export const Icon = ({ name: icon, size = "md", className }: IconProps) => {
  const Icon = icons[icon];
  return <Icon className={cn(iconVariants({ size }), className)} />;
};
