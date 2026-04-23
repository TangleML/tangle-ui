import { type ComponentPropsWithoutRef, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { Paragraph } from "@/components/ui/typography";

import TooltipButton from "./TooltipButton";

type IconOrChildren =
  | { icon: IconName; children?: never }
  | { children: ReactNode; icon?: never };

type AlwaysTooltipOrLabel =
  | { tooltip: string; label?: string }
  | { tooltip?: string; label: string };

type ActionButtonOwnProps = {
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
} & IconOrChildren &
  AlwaysTooltipOrLabel;

type ActionButtonProps = ActionButtonOwnProps &
  Omit<
    ComponentPropsWithoutRef<typeof TooltipButton>,
    keyof ActionButtonOwnProps | "variant" | "size"
  >;

export const ActionButton = ({
  tooltip,
  destructive,
  disabled,
  label,
  onClick,
  className,
  icon,
  children,
  ...rest
}: ActionButtonProps) => {
  return (
    <TooltipButton
      data-testid={`action-${label ?? tooltip}`}
      variant={destructive ? "destructive" : "outline"}
      tooltip={tooltip}
      onClick={onClick}
      disabled={disabled}
      className={className}
      size="sm"
      {...rest}
    >
      {children === undefined && icon ? <Icon name={icon} /> : children}
      {label && <Paragraph>{label}</Paragraph>}
    </TooltipButton>
  );
};
