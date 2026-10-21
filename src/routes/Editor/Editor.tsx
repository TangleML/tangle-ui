import "@/styles/editor.css";

import { DndContext } from "@dnd-kit/core";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect } from "react";

import PipelineEditor from "@/components/Editor/PipelineEditor";
import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { LocalPipelineMigration } from "@/components/shared/LocalPipelineMigration";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { useLoadComponentSpecFromPath } from "@/hooks/useLoadComponentSpecFromPath";
import { addRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { APP_ROUTES } from "@/routes/appRoutes";
import { readProjectIdParam } from "@/routes/projectRunSearch";
import { DriverPermissionGate } from "@/routes/v2/pages/Editor/components/DriverPermissionGate";

const LocalEditor = () => {
  const { componentSpec, error } = useLoadComponentSpecFromPath();
  useEffect(() => {
    if (!componentSpec?.name) return;
    addRecentlyViewed({
      type: "pipeline",
      id: componentSpec.name,
      name: componentSpec.name,
    });
  }, [componentSpec?.name]);

  if (error) {
    return (
      <BlockStack fill gap="4">
        <InfoBox variant="error" title="Error loading pipeline">
          {error}
        </InfoBox>
        <Paragraph tone="subdued" size="sm">
          Check that the pipeline still exists. You can also import it from a
          YAML file.
        </Paragraph>
      </BlockStack>
    );
  }

  if (!componentSpec) {
    return <LoadingScreen message="Loading Pipeline" />;
  }

  return (
    <DndContext>
      <ReactFlowProvider>
        <PipelineEditor />
      </ReactFlowProvider>
    </DndContext>
  );
};

const Editor = () => {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const pipelineId = "pipelineId" in params ? params.pipelineId : undefined;
  const projectId = readProjectIdParam(search);

  useEffect(() => {
    if (pipelineId) {
      void navigate({
        to: APP_ROUTES.EDITOR_V2_REMOTE_PIPELINE,
        params: { pipelineId },
        search: { projectId },
        replace: true,
      });
    }
  }, [navigate, pipelineId, projectId]);

  if (pipelineId) return <LoadingScreen message="Loading pipeline..." />;
  if (!("name" in params) || !params.name) return <LocalEditor />;

  const pipelineRef = {
    name: params.name,
    fileId:
      "fileId" in search && typeof search.fileId === "string"
        ? search.fileId
        : undefined,
  };
  return (
    <DriverPermissionGate pipelineRef={pipelineRef}>
      <LocalPipelineMigration
        pipelineRef={pipelineRef}
        projectId={projectId}
        onMigrated={(file, clearProjectContext) => {
          void navigate({
            to: APP_ROUTES.EDITOR_V2_REMOTE_PIPELINE,
            params: { pipelineId: file.id },
            search: { projectId: clearProjectContext ? undefined : projectId },
            replace: true,
          });
        }}
      >
        <LocalEditor />
      </LocalPipelineMigration>
    </DriverPermissionGate>
  );
};

export default Editor;
