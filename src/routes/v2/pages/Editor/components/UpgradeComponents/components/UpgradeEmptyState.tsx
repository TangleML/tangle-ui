import { EmptyState } from "@/components/ui/empty-state";

export function UpgradeEmptyState() {
  return (
    <EmptyState
      icon="CircleCheck"
      tone="success"
      description="All components are up to date."
    />
  );
}
