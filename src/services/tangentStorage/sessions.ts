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

export function getSession(
  sessionId: string,
): Promise<TangentSession | undefined> {
  return tangentDb.sessions.get(sessionId);
}

export async function setOpeningPrompt(
  sessionId: string,
  openingPrompt: string,
): Promise<void> {
  await tangentDb.sessions.update(sessionId, { openingPrompt });
}

export async function removeSession(sessionId: string): Promise<void> {
  await tangentDb.sessions.delete(sessionId);
}
