import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { ComponentReferenceBar } from "@/components/shared/TaskDetails/ComponentReferenceBar";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { useCopyNodeLink } from "@/hooks/useCopyNodeLink";
import { useHydrateComponentReference } from "@/hooks/useHydrateComponentReference";
import type { ComponentReference } from "@/utils/componentSpec";
import { getComponentName } from "@/utils/getComponentName";

interface RunViewTaskComponentProps {
  componentRef: ComponentReference;
  taskName: string;
}

const RunViewTaskComponentInternal = ({
  componentRef,
  taskName,
}: RunViewTaskComponentProps) => {
  const hydratedRef = useHydrateComponentReference(componentRef);
  const copyNodeLink = useCopyNodeLink(taskName);

  if (!hydratedRef) return null;

  const componentName = getComponentName(hydratedRef);

  return (
    <ComponentReferenceBar
      componentRef={hydratedRef}
      yamlText={hydratedRef.text}
      filename={componentName}
      pythonCode={hydratedRef.spec.metadata?.annotations?.python_original_code}
      pythonFilename={hydratedRef.name || componentName}
      readOnly
      trackingPrefix="v2.run_view.context_panel"
      additionalMenuItems={
        <DropdownMenuItem onSelect={copyNodeLink}>
          <Icon name="Link" size="sm" />
          Copy node link
        </DropdownMenuItem>
      }
    />
  );
};

export const RunViewTaskComponent = withSuspenseWrapper(
  RunViewTaskComponentInternal,
);
