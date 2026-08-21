import { useTangent } from "@tangent/embed-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import { APP_ROUTES } from "@/routes/appRoutes";
import { TANGENT_BUNDLE_ID } from "@/routes/v2/shared/tangent/constants";
import {
  createProject,
  deriveProjectName,
  setActiveSession,
} from "@/services/tangentStorage/projects";
import { addSession } from "@/services/tangentStorage/sessions";
import { getErrorMessage } from "@/utils/string";

/**
 * Creates a Tangent Shell project, starts a Tangent session seeded with the
 * prompt, links them locally, and navigates into the project workspace.
 */
export function useCreateProjectWithSession() {
  const { newSession } = useTangent();
  const navigate = useNavigate();
  const notify = useToastNotification();
  const [isCreating, setIsCreating] = useState(false);

  async function createWithPrompt(prompt: string) {
    const trimmed = prompt.trim();
    if (!trimmed || isCreating) return;

    setIsCreating(true);
    try {
      const project = await createProject(deriveProjectName(trimmed));
      const { sessionId } = await newSession(trimmed, TANGENT_BUNDLE_ID);
      await addSession({
        sessionId,
        projectId: project.id,
        openingPrompt: trimmed,
      });
      await setActiveSession(project.id, sessionId);

      await navigate({
        to: APP_ROUTES.TANGENT_PROJECT,
        params: { projectId: project.id },
      });
    } catch (error) {
      notify(getErrorMessage(error), "error");
    } finally {
      setIsCreating(false);
    }
  }

  return { createWithPrompt, isCreating };
}
