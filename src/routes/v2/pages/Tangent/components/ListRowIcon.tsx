import { Icon, type IconName } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";

export function ListRowIcon({ icon }: { icon: IconName }) {
  return (
    <InlineStack
      align="center"
      blockAlign="center"
      className="size-9 shrink-0 rounded-md bg-muted text-muted-foreground"
    >
      <Icon name={icon} size="lg" />
    </InlineStack>
  );
}
