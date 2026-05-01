import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export function ComponentLibraryWindowMiniContent() {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-8 shrink-0 rounded-md"
      aria-label="Components"
    >
      <Icon name="LayoutGrid" size="sm" className="text-gray-700" />
    </Button>
  );
}
