import { cva, type VariantProps } from "class-variance-authority";

import { Icon, type IconName } from "@/components/ui/icon";

const iconTileVariants = cva("grid shrink-0 place-items-center", {
  variants: {
    size: {
      sm: "size-8 rounded-md",
      md: "size-9 rounded-md",
      lg: "size-12 rounded-xl",
    },
    shape: {
      square: "",
      round: "rounded-full",
    },
    tone: {
      subdued: "bg-muted text-muted-foreground",
      info: "bg-info/15 text-info",
      accent: "bg-edge-selected/15 text-edge-selected",
    },
  },
  defaultVariants: {
    size: "md",
    shape: "square",
    tone: "subdued",
  },
});

const ICON_SIZE = { sm: "sm", md: "lg", lg: "lg" } as const;

/** An icon on a tinted tile, introducing a row, a dialog or a setting. */
export function IconTile({
  icon,
  size = "md",
  shape,
  tone,
}: { icon: IconName } & VariantProps<typeof iconTileVariants>) {
  return (
    <span aria-hidden className={iconTileVariants({ size, shape, tone })}>
      <Icon name={icon} size={ICON_SIZE[size ?? "md"]} />
    </span>
  );
}
