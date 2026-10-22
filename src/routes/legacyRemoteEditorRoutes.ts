import { type AnyRoute, createRoute, redirect } from "@tanstack/react-router";

import { APP_ROUTES } from "@/routes/appRoutes";

export function createLegacyRemoteEditorRoutes<TParent extends AnyRoute>(
  parent: TParent,
) {
  const legacyEditor = createRoute({
    getParentRoute: () => parent,
    path: APP_ROUTES.LEGACY_REMOTE_PIPELINE_EDITOR,
    beforeLoad: ({ params, location }) => {
      throw redirect({
        to: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
        params: () => ({ pipelineId: params.pipelineId }),
        search: (previous) => previous,
        hash: location.hash,
        replace: true,
      });
    },
  });
  const legacyEditorV2 = createRoute({
    getParentRoute: () => parent,
    path: APP_ROUTES.LEGACY_EDITOR_V2_REMOTE_PIPELINE,
    beforeLoad: ({ params, location }) => {
      throw redirect({
        to: APP_ROUTES.REMOTE_PIPELINE_EDITOR,
        params: () => ({ pipelineId: params.pipelineId }),
        search: (previous) => previous,
        hash: location.hash,
        replace: true,
      });
    },
  });

  return [legacyEditor, legacyEditorV2];
}
