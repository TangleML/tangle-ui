import { Alert, AlertDescription } from "@/components/ui/alert";
import { Icon } from "@/components/ui/icon";
import { activeWorkspaces } from "@/services/projects/defaultWorkspace";
import { useWorkspaces } from "@/services/projects/useWorkspaces";

export function WorkspaceNotice() {
  const { data: workspaces, error } = useWorkspaces();

  const message = error
    ? `Could not load workspaces, so a project cannot be created: ${error.message}`
    : workspaces && activeWorkspaces(workspaces).length === 0
      ? "Projects cannot be created yet. Contact your Tangle Admin for help."
      : undefined;

  if (!message) return null;

  return (
    <Alert className="w-fit">
      <Icon name="CircleAlert" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
