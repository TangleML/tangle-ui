import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/utils/string";

import { Button } from "./button";

interface CopyTextProps {
  children: string;
  className?: string;
}

export const CopyText = ({ children, className }: CopyTextProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = useCallback(() => {
    copyToClipboard(children);
    setIsCopied(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsCopied(false);
    }, 1000);
  }, [children]);

  return (
    <div
      className="group flex items-center gap-1 cursor-pointer"
      onClick={handleCopy}
      title={children}
    >
      <span className={className}>{children}</span>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
          isCopied && "opacity-100",
        )}
        onClick={(e) => {
          e.stopPropagation();
          handleCopy();
        }}
      >
        {isCopied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </Button>
    </div>
  );
};
