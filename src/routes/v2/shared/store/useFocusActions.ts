import { focusValidationIssue, navigateToEntity } from "./focus.actions";
import { useSharedStores } from "./SharedStoreContext";

export function useFocusActions() {
  const { editor, navigation } = useSharedStores();

  return {
    navigateToEntity: navigateToEntity.bind(null, editor, navigation),
    focusValidationIssue: focusValidationIssue.bind(null, editor),
  };
}
