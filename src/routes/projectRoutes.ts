import { isTangentEnabled } from "@/components/shared/Settings/useFlags";

import { APP_ROUTES } from "./appRoutes";

/**
 * Where a project opens. Tangent takes the project's own page over when it is
 * on, so linking to the details page as well would leave two links for one
 * project and hand over the one nobody navigates to.
 */
export function projectHomeRoute(tangentEnabled: boolean) {
  return tangentEnabled
    ? APP_ROUTES.TANGENT_PROJECT
    : APP_ROUTES.PROJECT_DETAIL;
}

export function getProjectHomeRoute() {
  return projectHomeRoute(isTangentEnabled());
}

function projectPath(route: string, projectId: string): string {
  return route.replace("$projectId", encodeURIComponent(projectId));
}

export function getProjectHomePath(projectId: string): string {
  return projectPath(getProjectHomeRoute(), projectId);
}

export function getTangentProjectPath(projectId: string): string {
  return projectPath(APP_ROUTES.TANGENT_PROJECT, projectId);
}
