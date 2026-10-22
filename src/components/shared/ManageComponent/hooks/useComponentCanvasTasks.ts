import { useOptionalSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export function useComponentCanvasTasks(digest: string) {
  const stores = useOptionalSharedStores();
  return (
    stores?.navigation.activeSpec?.tasks.filter(
      (task) => task.componentRef.digest === digest,
    ) ?? []
  );
}
