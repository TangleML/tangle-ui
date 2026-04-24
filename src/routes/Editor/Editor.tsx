import "@/styles/editor.css";

import { DndContext } from "@dnd-kit/core";
import { useBlocker } from "@tanstack/react-router";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useRef } from "react";

import PipelineEditor from "@/components/Editor/PipelineEditor";
import ConfirmationDialog from "@/components/shared/Dialogs/ConfirmationDialog";
import { InfoBox } from "@/components/shared/InfoBox";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { getFlexNodeAnnotations } from "@/components/shared/ReactFlow/FlowCanvas/FlexNode/interface";
import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { useLoadComponentSpecFromPath } from "@/hooks/useLoadComponentSpecFromPath";
import { addRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { deletePipeline } from "@/services/pipelineService";
import { markPipelineForDeletion } from "@/utils/deletePipelineCleanup";
import { consumeSkipNavigationBlock } from "@/utils/skipNavigationBlock";

const Editor = () => {
  const { componentSpec, error } = useLoadComponentSpecFromPath();
  const { graphSpec } = useComponentSpec();

  useEffect(() => {
    if (!componentSpec?.name) return;
    addRecentlyViewed({
      type: "pipeline",
      id: componentSpec.name,
      name: componentSpec.name,
    });
  }, [componentSpec?.name]);

  const shouldBlockRef = useRef(false);
  const nameRef = useRef(componentSpec?.name);
  nameRef.current = componentSpec?.name;

  const isModifiedRef = useRef(false);
  if (componentSpec) {
    isModifiedRef.current =
      Boolean(componentSpec.description) ||
      Object.keys(componentSpec.metadata?.annotations ?? {}).some(
        (k) => k !== "sdk" && k !== "editor.flow-direction",
      );
  }

  const isPipelineEmpty =
    !Object.keys(graphSpec.tasks ?? {}).length &&
    !Object.keys(graphSpec.outputValues ?? {}).length &&
    !componentSpec?.inputs?.length &&
    !componentSpec?.outputs?.length &&
    !(componentSpec && getFlexNodeAnnotations(componentSpec).length);

  shouldBlockRef.current =
    Boolean(componentSpec?.name) &&
    isFlagEnabled("auto-delete-empty-pipelines") &&
    isPipelineEmpty;

  const blocker = useBlocker({
    shouldBlockFn: ({ next }) => {
      if (!shouldBlockRef.current) return false;
      if (next.pathname.startsWith("/settings")) return false;
      if (consumeSkipNavigationBlock()) return false;
      return true;
    },
    enableBeforeUnload: false,
    withResolver: true,
  });

  useEffect(() => {
    if (blocker.status !== "blocked") return;
    if (isModifiedRef.current) return;
    const name = nameRef.current;
    if (name) void deletePipeline(name);
    blocker.proceed();
  }, [blocker.status]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!shouldBlockRef.current) return;
      const name = nameRef.current;
      if (name) markPipelineForDeletion(name);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  if (error) {
    return (
      <BlockStack fill gap="4">
        <InfoBox variant="error" title="Error loading pipeline">
          {error}
        </InfoBox>
        <Paragraph tone="subdued" size="sm">
          Tip: Pipelines are stored locally and are not shareable by URL. To
          share a pipeline it needs to be exported.
        </Paragraph>
      </BlockStack>
    );
  }

  if (!componentSpec) {
    return <LoadingScreen message="Loading Pipeline" />;
  }

  return (
    <>
      <DndContext>
        <ReactFlowProvider>
          <PipelineEditor />
        </ReactFlowProvider>
      </DndContext>

      <ConfirmationDialog
        isOpen={blocker.status === "blocked" && isModifiedRef.current}
        title="Delete empty pipeline?"
        description="This pipeline has been modified but is still empty."
        destructive
        secondaryAction={{
          label: "Keep Pipeline",
          onClick: () => blocker.proceed?.(),
          variant: "default",
        }}
        onConfirm={() => {
          const name = nameRef.current;
          if (name) void deletePipeline(name);
          blocker.proceed?.();
        }}
        onCancel={() => blocker.reset?.()}
      />
    </>
  );
};

export default Editor;
