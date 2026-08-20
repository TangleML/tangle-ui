import { ArtifactViewer } from "@tangent/embed-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { VerticalResizeHandle } from "@/components/ui/resize-handle";
import { Text } from "@/components/ui/typography";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";

const DEFAULT_WIDTH = 460;
const MIN_WIDTH = 320;
const MAX_WIDTH = 760;

/**
 * The right-hand "Dynamic Workarea": a tabbed surface that later phases fill
 * with an Editor canvas, an ArtifactViewer, a RunView, or other context-driven
 * views. Today it renders an opened Tangent artifact, or an empty state.
 */
export function DynamicWorkarea() {
  const { openArtifact, activeSessionId, closeArtifact } = useTangentProject();
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  function handleResizeEnd(attemptedWidth: number) {
    setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, attemptedWidth)));
  }

  const showArtifact = openArtifact !== null && activeSessionId !== undefined;

  return (
    <div
      className="relative flex h-full shrink-0 flex-col border-l border-border bg-card"
      style={{ width }}
    >
      <VerticalResizeHandle
        side="left"
        minWidth={MIN_WIDTH}
        maxWidth={MAX_WIDTH}
        onResizeEnd={handleResizeEnd}
      />
      <InlineStack
        gap="2"
        blockAlign="center"
        align="space-between"
        className="h-9 shrink-0 border-b border-border px-3"
      >
        <Text
          size="xs"
          weight="semibold"
          tone="subdued"
          className="min-w-0 truncate"
        >
          {showArtifact ? openArtifact.title : "Workarea"}
        </Text>
        {showArtifact ? (
          <Button
            type="button"
            variant="ghost"
            size="min"
            aria-label="Close artifact"
            title="Close artifact"
            onClick={closeArtifact}
          >
            <Icon name="X" size="xs" />
          </Button>
        ) : null}
      </InlineStack>
      {showArtifact ? (
        <ArtifactViewer
          sessionId={activeSessionId}
          url={openArtifact.url}
          title={openArtifact.title}
          className="min-h-0 flex-1"
          style={{ height: "100%" }}
        />
      ) : (
        <BlockStack
          gap="2"
          align="center"
          className="min-h-0 flex-1 justify-center p-6 text-center"
        >
          <Icon
            name="LayoutTemplate"
            size="lg"
            className="text-muted-foreground"
          />
          <Text size="sm" weight="semibold">
            Nothing open yet
          </Text>
          <Text size="sm" tone="subdued">
            Tangent will open pipelines, artifacts, and runs here as you work.
          </Text>
        </BlockStack>
      )}
    </div>
  );
}
