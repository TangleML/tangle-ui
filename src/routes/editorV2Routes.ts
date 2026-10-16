import { type AnyRoute, createRoute, redirect } from "@tanstack/react-router";
import { generate } from "random-words";

import { isFlagEnabled } from "@/components/shared/Settings/useFlags";

import { APP_ROUTES } from "./appRoutes";
import { EditorV2 } from "./v2/pages/Editor/EditorV2";

declare module "@tanstack/react-router" {
  interface HistoryState {
    newPipeline?: { name: string; draftId: string };
  }
}

/** Keep the editor mounted when a draft acquires its remote URL. */
export function createEditorV2Routes<TParent extends AnyRoute>(
  parent: TParent,
) {
  const layout = createRoute({
    getParentRoute: () => parent,
    id: "editor-v2-layout",
    component: EditorV2,
  });
  const index = createRoute({
    getParentRoute: () => layout,
    path: APP_ROUTES.EDITOR_V2,
    beforeLoad: () => {
      if (!isFlagEnabled("v2_editor")) {
        throw redirect({ to: APP_ROUTES.DASHBOARD_PIPELINES });
      }
    },
  });
  const pipeline = createRoute({
    getParentRoute: () => layout,
    path: APP_ROUTES.EDITOR_V2_PIPELINE,
    beforeLoad: ({ params }) => {
      if (!isFlagEnabled("v2_editor")) {
        throw redirect({
          to: APP_ROUTES.PIPELINE_EDITOR,
          params: { name: params.pipelineName },
        });
      }
    },
  });
  const newPipeline = createRoute({
    getParentRoute: () => layout,
    path: APP_ROUTES.EDITOR_V2_NEW_PIPELINE,
    beforeLoad: ({ location }) => {
      if (!isFlagEnabled("v2_editor")) {
        throw redirect({ to: APP_ROUTES.DASHBOARD_PIPELINES });
      }
      return {
        newPipeline: location.state.newPipeline ?? {
          name: generate({ exactly: 4, join: " " }),
          draftId: location.state.__TSR_key!,
        },
      };
    },
  });
  const remotePipeline = createRoute({
    getParentRoute: () => layout,
    path: APP_ROUTES.EDITOR_V2_REMOTE_PIPELINE,
  });
  return layout.addChildren([index, pipeline, newPipeline, remotePipeline]);
}
