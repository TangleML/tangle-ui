import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";

/**
 * A save that the store refuses leaves the editor holding the only copy of the
 * work, and a tooltip on a toolbar icon is not where someone finds that out.
 * It stays up until a save lands, because the risk lasts exactly that long.
 */
export const UnsavedWorkBanner = observer(function UnsavedWorkBanner() {
  const { autoSave } = useEditorSession();
  const { saveError, isSaving } = autoSave;

  if (!saveError) return null;

  return (
    <InlineStack
      align="center"
      blockAlign="center"
      gap="3"
      wrap="nowrap"
      className="w-full bg-destructive/15 border-b border-destructive/40 px-4 py-1.5"
      data-testid="unsaved-work-banner"
    >
      {isSaving ? (
        <Spinner size={16} />
      ) : (
        <Icon name="CloudOff" className="text-destructive shrink-0" />
      )}
      <Text size="sm">
        Your changes are not saved. They are kept here and will be saved as soon
        as they can be. {saveError}
      </Text>
      <Button
        size="sm"
        variant="secondary"
        disabled={isSaving}
        onClick={() => void autoSave.save()}
      >
        Try now
      </Button>
    </InlineStack>
  );
});
