import { observer } from "mobx-react-lite";

import { useAwaitAuthorization } from "@/components/shared/Authentication/useAwaitAuthorization";
import TangleSubmitter from "@/components/shared/Submitters/Tangle/TangleSubmitter";
import { serializeComponentSpec } from "@/models/componentSpec";
import { useQuickRunSubmitter } from "@/routes/v2/pages/Editor/components/QuickRunSubmitterContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { deepClone } from "@/utils/deepClone";

export const QuickRunSubmitter = observer(function QuickRunSubmitter() {
  const { navigation } = useSharedStores();
  const { isAuthorized } = useAwaitAuthorization();
  const { registerSubmitter } = useQuickRunSubmitter();
  const rootSpec = navigation.rootSpec;
  const allIssues = rootSpec?.allValidationIssues ?? [];
  const hasErrors = allIssues.some((issue) => issue.severity === "error");

  let serializedPipelineSpec:
    ReturnType<typeof serializeComponentSpec> | undefined;
  try {
    serializedPipelineSpec = rootSpec
      ? deepClone(serializeComponentSpec(rootSpec))
      : undefined;
  } catch {
    serializedPipelineSpec = undefined;
  }

  if (!serializedPipelineSpec || !isAuthorized) return null;

  return (
    <div ref={registerSubmitter} className="sr-only">
      <TangleSubmitter
        componentSpec={serializedPipelineSpec}
        isComponentTreeValid={rootSpec?.isValid}
        onlyFixableIssues={!hasErrors && allIssues.length > 0}
      />
    </div>
  );
});
