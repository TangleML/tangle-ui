import type { Task } from "@/models/componentSpec/entities/task";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";

export function useTask(taskId: string): Task | null {
  const spec = useSpec();
  return spec?.tasks.find((t) => t.$id === taskId) ?? null;
}
