import PipelineRow from "@/components/Home/PipelineSection/PipelineRow";
import { Icon } from "@/components/ui/icon";

import type { LocalPipelineFile } from "../../../services/connectedFolderStorage";

interface LocalPipelineRowsProps {
  pipelines: LocalPipelineFile[];
  selectedPipelines: Set<string>;
  onSelectPipeline: (name: string, checked: boolean) => void;
  onImport: (variables: {
    fileHandle: FileSystemFileHandle;
    fileName: string;
  }) => void;
  importingFileName: string | undefined;
}

export function LocalPipelineRows({
  pipelines,
  selectedPipelines,
  onSelectPipeline,
  onImport,
  importingFileName,
}: LocalPipelineRowsProps) {
  return (
    <>
      {pipelines.map((localFile) => (
        <PipelineRow
          key={localFile.fileName}
          name={localFile.name}
          modificationTime={new Date(localFile.lastModified)}
          isSelected={selectedPipelines.has(localFile.fileName)}
          onSelect={(checked) => onSelectPipeline(localFile.fileName, checked)}
          onPipelineClick={() =>
            onImport({
              fileHandle: localFile.handle,
              fileName: localFile.fileName,
            })
          }
          icon={
            importingFileName === localFile.fileName ? (
              <Icon
                name="LoaderCircle"
                size="lg"
                className="shrink-0 animate-spin text-muted-foreground"
              />
            ) : (
              <Icon
                name="FileSpreadsheet"
                fill="currentColor"
                stroke="#2563eb"
                size="lg"
                className="shrink-0 text-blue-500"
              />
            )
          }
        />
      ))}
    </>
  );
}
