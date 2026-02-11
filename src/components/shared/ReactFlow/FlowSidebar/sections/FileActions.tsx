import { useEffect, useMemo, useState } from "react";

import { InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { useAutoSaveStatus } from "@/providers/AutoSaveProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { getPipelineFile } from "@/services/pipelineService";
import { formatRelativeTime } from "@/utils/date";

import { SidebarSection } from "../components/SidebarSection";
import { ExportPipelineButton } from "./components/ExportPipelineButton";
import { ImportPipelineButton } from "./components/ImportPipelineButton";
import { SavePipelineAsButton } from "./components/SavePipelineAsButton";
import { SavePipelineButton } from "./components/SavePipelineButton";

interface AutoSaveStatusProps {
  lastSavedAt: Date | null;
}

const AutoSaveStatus = ({ lastSavedAt }: AutoSaveStatusProps) => {
  const { autoSaveStatus } = useAutoSaveStatus();

  const statusText = useMemo(() => {
    if (autoSaveStatus.isSaving) {
      return "Saving...";
    }
    if (autoSaveStatus.lastSavedAt || lastSavedAt) {
      return `Last saved ${formatRelativeTime(
        autoSaveStatus.lastSavedAt ?? lastSavedAt,
      )}`;
    }
    return "All changes saved";
  }, [autoSaveStatus, lastSavedAt]);

  return (
    <InlineStack className="overflow-y-hidden" gap="1">
      {autoSaveStatus.isSaving && <Spinner size={16} />}
      <Text as="span" size="xs" tone="subdued">
        {statusText}
      </Text>
    </InlineStack>
  );
};

const FileActions = () => {
  const { componentSpec } = useComponentSpec();
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    const fetchLastSaved = async () => {
      if (componentSpec?.name) {
        const lastSavedPipeline = await getPipelineFile(componentSpec.name);
        setLastSavedAt(lastSavedPipeline?.modificationTime ?? null);
      }
    };
    fetchLastSaved();
  }, [componentSpec?.name]);

  const handleSaveComplete = () => {
    setLastSavedAt(new Date());
  };

  return (
    <SidebarSection title="Pipeline Actions">
      <AutoSaveStatus lastSavedAt={lastSavedAt} />

      <InlineStack gap="2" className="text-foreground/75">
        <SavePipelineButton onSaveComplete={handleSaveComplete} />
        <SavePipelineAsButton />
        <ExportPipelineButton />
        <ImportPipelineButton />
      </InlineStack>
    </SidebarSection>
  );
};

export default FileActions;
