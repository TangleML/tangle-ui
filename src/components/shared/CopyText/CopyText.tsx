import { type MouseEvent, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/utils/string";

interface CopyTextProps {
  children: string;
  className?: string;
  alwaysShowButton?: boolean;
}

export const CopyText = ({
  children,
  className,
  alwaysShowButton = false,
}: CopyTextProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleCopy = useCallback(() => {
    copyToClipboard(children);
    setIsCopied(true);
  }, [children]);

  const handleButtonClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      handleCopy();
    },
    [handleCopy],
  );

  const handleAnimationEnd = useCallback(() => {
    setIsCopied(false);
  }, []);

  return (
    <div
      className="group cursor-pointer"
      onClick={handleCopy}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={children}
    >
      <InlineStack gap="1" blockAlign="center" wrap="nowrap">
        <Text
          className={cn(
            "transition-all duration-150",
            className,
            isCopied && "scale-[1.01] text-emerald-400!",
          )}
        >
          {children}
        </Text>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 shrink-0 transition-opacity duration-200",
            alwaysShowButton || isCopied
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100",
          )}
          onClick={handleButtonClick}
        >
          <CopyIcon
            isCopied={isCopied}
            alwaysShow={alwaysShowButton || isHovered}
            onAnimationEnd={handleAnimationEnd}
          />
        </Button>
      </InlineStack>
    </div>
  );
};

interface CopyIconProps {
  isCopied: boolean;
  alwaysShow: boolean;
  onAnimationEnd: () => void;
}
//
const CopyIcon = ({ isCopied, alwaysShow, onAnimationEnd }: CopyIconProps) => (
  <span className="relative h-3.5 w-3.5">
    {isCopied ? (
      <span
        className="absolute inset-0 animate-revert-copied"
        onAnimationEnd={onAnimationEnd}
      >
        <Icon name="Check" size="sm" className="text-emerald-400" />
      </span>
    ) : (
      <Icon
        name="Copy"
        size="sm"
        className={cn(
          "absolute inset-0 text-muted-foreground transition-all duration-200",
          alwaysShow
            ? "rotate-0 scale-100 opacity-100"
            : "rotate-90 scale-0 opacity-0",
        )}
      />
    )}
  </span>
);
