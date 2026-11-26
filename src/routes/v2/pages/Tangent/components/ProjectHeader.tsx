import { createElement } from "react";

import { InlineStack } from "@/components/ui/layout";
import { AppMenuActions } from "@/routes/v2/shared/components/AppMenuActions";
import {
  CanvasHomeLink,
  CanvasMenuBar,
} from "@/routes/v2/shared/components/CanvasMenuBar";

const SESSION_PRESENCE_ELEMENT = "tangent-session-presence";

/**
 * The app's top bar on a Tangent project, as the editor and run pages own
 * theirs. The project itself is named in the sidebar and its Project panel,
 * and its settings live beside the chat it configures.
 */
export function ProjectHeader({ sessionId }: { sessionId?: string }) {
  return (
    <CanvasMenuBar>
      <InlineStack blockAlign="center">
        <CanvasHomeLink trackingId="projects.menu_bar.home" wordmark />
      </InlineStack>

      <InlineStack
        gap="2"
        wrap="nowrap"
        blockAlign="center"
        className="min-w-0"
      >
        {sessionId && customElements.get(SESSION_PRESENCE_ELEMENT)
          ? createElement(SESSION_PRESENCE_ELEMENT, {
              "session-id": sessionId,
              className: "min-w-0",
            })
          : null}
        {/* Each chat composer has its own model picker. */}
        <AppMenuActions showAiModelQuickSelect={false} />
      </InlineStack>
    </CanvasMenuBar>
  );
}
