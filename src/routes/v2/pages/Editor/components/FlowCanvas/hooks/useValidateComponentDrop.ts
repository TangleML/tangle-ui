import { useQueryClient } from "@tanstack/react-query";

import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { ComponentValidationDialog } from "@/routes/v2/pages/Editor/components/FlowCanvas/components/ComponentValidationDialog";
import { hydrateComponentReference } from "@/services/componentService";
import { componentSpecValidatorQuery } from "@/services/componentSpecValidation";
import type { ComponentReference } from "@/utils/componentSpec";

export function useValidateComponentDrop() {
  const queryClient = useQueryClient();
  const { open } = useDialog();

  return async (reference: ComponentReference) => {
    let title = "Invalid component";
    let errors: string[];
    let componentName = reference.spec?.name ?? reference.name ?? "Component";

    try {
      const component = await hydrateComponentReference(reference);
      const validator = await queryClient.fetchQuery(
        componentSpecValidatorQuery,
      );
      const result = validator(
        component?.spec ?? reference.text ?? reference.spec,
      );
      componentName = component?.name ?? componentName;
      if (component && result.valid) return component;
      errors = result.errors?.length
        ? result.errors
        : [
            "The component definition could not be loaded. Check its source and try again.",
          ];
    } catch {
      title = "Unable to validate component";
      errors = [
        "The component or its validation schema could not be loaded. Try dropping the component again.",
      ];
    }

    await open({
      component: ComponentValidationDialog,
      props: { title, componentName, errors },
    }).catch(convertCancelErrorTo(undefined));
    return null;
  };
}
