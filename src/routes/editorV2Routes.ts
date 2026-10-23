import { type AnyRoute, createRoute, redirect } from "@tanstack/react-router";
import { generate } from "random-words";

import { getPipelineCreationBackendUrl } from "@/services/pipelineStorage/pipelineCreation";

import { APP_ROUTES } from "./appRoutes";
import { validateRemotePipelineSearch } from "./remotePipelineSearch";
import { EditorV2 } from "./v2/pages/Editor/EditorV2";

declare module "@tanstack/react-router" {
  interface HistoryState {
    newPipeline?: {
      name: string;
      draftId: string;
      storage?: "local" | "remote";
    };
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
    path: APP_ROUTES.EDITOR,
  });
  const pipeline = createRoute({
    getParentRoute: () => layout,
    path: APP_ROUTES.PIPELINE_EDITOR,
  });
  const newPipeline = createRoute({
    getParentRoute: () => layout,
    path: APP_ROUTES.EDITOR_NEW_PIPELINE,
    beforeLoad: async ({ location }) => {
      if (!location.state.newPipeline?.storage) {
        throw redirect({
          to: APP_ROUTES.EDITOR_NEW_PIPELINE,
          replace: true,
          state: {
            ...location.state,
            newPipeline: {
              name:
                location.state.newPipeline?.name ??
                generate({ exactly: 4, join: " " }),
              draftId:
                location.state.newPipeline?.draftId ?? crypto.randomUUID(),
              storage: (await getPipelineCreationBackendUrl())
                ? "remote"
                : "local",
            },
          },
        });
      }
      return {
        newPipeline: location.state.newPipeline,
      };
    },
  });
  const remotePipeline = createRoute({
    getParentRoute: () => layout,
    path: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
    validateSearch: validateRemotePipelineSearch,
  });
  return layout.addChildren([index, pipeline, newPipeline, remotePipeline]);
}
