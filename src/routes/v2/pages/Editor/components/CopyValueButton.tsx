import { useEffect, useState } from "react";

import { CopyIcon } from "@/components/shared/CopyText/CopyText";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/utils/string";

export function CopyValueButton({
  valueFn,
  className,
}: {
  className?: string;
  valueFn: () => string | undefined;
}) {
  const [isCopied, setIsCopied] = useState(false);

  const copyValue = () => {
    const value = valueFn();
    if (!value) return;

    copyToClipboard(value);
    setIsCopied(true);
  };

  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={copyValue}
      className={cn(className)}
    >
      <CopyIcon isCopied={isCopied} alwaysShow={true} compact={true} />
    </Button>
  );
}
