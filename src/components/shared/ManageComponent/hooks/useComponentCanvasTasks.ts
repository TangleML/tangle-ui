import { useComponentSpec } from "@/providers/ComponentSpecProvider";

/**
 * Returns the tasks on the canvas that use the component with the given digest.
 *
 * @param digest - The digest of the component to find tasks for.
 * @returns The tasks on the canvas that use the component with the given digest.
 */
export function useComponentCanvasTasks(digest: string) {
  const { graphSpec } = useComponentSpec();

  return Object.values(graphSpec?.tasks).filter(
    (task) => task.componentRef.digest === digest,
  );
}
