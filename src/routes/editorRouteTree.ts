import { type AnyRoute, createRoute, redirect } from "@tanstack/react-router";
import { generate } from "random-words";

import { APP_ROUTES } from "./appRoutes";
import { validateRemotePipelineSearch } from "./remotePipelineSearch";
import { Editor } from "./v2/pages/Editor/Editor";

declare module "@tanstack/react-router" {
  interface HistoryState {
    newPipeline?: {
      name: string;
      draftId: string;
    };
  }
}

/** Keep the editor mounted when a draft acquires its remote URL. */
export function createEditorRoutes<TParent extends AnyRoute>(parent: TParent) {
  const layout = createRoute({
    getParentRoute: () => parent,
    id: "editor-layout",
    component: Editor,
  });
  const index = createRoute({
    getParentRoute: () => layout,
    path: APP_ROUTES.EDITOR,
  });
  const newPipeline = createRoute({
    getParentRoute: () => layout,
    path: APP_ROUTES.NEW_PIPELINE,
    beforeLoad: ({ location }) => {
      if (!location.state.newPipeline) {
        throw redirect({
          to: APP_ROUTES.NEW_PIPELINE,
          replace: true,
          state: {
            ...location.state,
            newPipeline: {
              name: generate({ exactly: 4, join: " " }),
              draftId: crypto.randomUUID(),
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
  return layout.addChildren([index, newPipeline, remotePipeline]);
}
