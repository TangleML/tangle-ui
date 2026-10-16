import { useEffect, useState } from "react";

import { CopyIcon } from "@/components/shared/CopyText/CopyText";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/utils/string";
import { tracking } from "@/utils/tracking";

export function CopyValueButton({
  valueFn,
  className,
  trackingId,
  trackingMetadata,
}: {
  className?: string;
  valueFn: () => string | undefined;
  trackingId?: string;
  trackingMetadata?: Record<string, unknown>;
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
      {...(trackingId ? tracking(trackingId, trackingMetadata) : {})}
    >
      <CopyIcon isCopied={isCopied} alwaysShow={true} compact={true} />
    </Button>
  );
}
