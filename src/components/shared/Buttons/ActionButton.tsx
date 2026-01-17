import { type ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/icon";
import { Paragraph } from "@/components/ui/typography";

import TooltipButton from "./TooltipButton";

type ActionButtonProps = {
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  displayLabel?: string;
  onClick: () => void;
  className?: string;
} & (
  | { icon: IconName; children?: never }
  | { children: ReactNode; icon?: never }
);

export const ActionButton = ({
  label,
  destructive,
  disabled,
  displayLabel,
  onClick,
  className,
  icon,
  children,
}: ActionButtonProps) => {
  return (
    <TooltipButton
      data-testid={`action-${label}`}
      variant={destructive ? "destructive" : "outline"}
      tooltip={label}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children === undefined && icon ? <Icon name={icon} /> : children}
      {displayLabel && <Paragraph>{displayLabel}</Paragraph>}
    </TooltipButton>
  );
};
