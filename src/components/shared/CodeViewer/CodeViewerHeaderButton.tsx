import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CodeViewerHeaderButtonProps = Omit<ButtonProps, "variant" | "size">;

export const CodeViewerHeaderButton = ({
  className,
  ...props
}: CodeViewerHeaderButtonProps) => (
  <Button
    variant="ghost"
    size="min"
    className={cn("text-muted-foreground hover:text-foreground", className)}
    {...props}
  />
);
