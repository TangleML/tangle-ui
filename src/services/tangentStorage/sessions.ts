import { tangentDb } from "./db";
import type { TangentSession } from "./types";

interface AddSessionInput {
  sessionId: string;
  projectId: string;
  openingPrompt?: string;
}

export async function addSession({
  sessionId,
  projectId,
  openingPrompt,
}: AddSessionInput): Promise<TangentSession> {
  const session: TangentSession = {
    id: sessionId,
    projectId,
    createdAt: Date.now(),
    openingPrompt,
  };
  await tangentDb.sessions.add(session);
  return session;
}

export function listProjectSessions(
  projectId: string,
): Promise<TangentSession[]> {
  return tangentDb.sessions
    .where("projectId")
    .equals(projectId)
    .sortBy("createdAt");
}
