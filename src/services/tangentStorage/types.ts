type ProjectStatus = "active" | "idle";

export interface TangentProject {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  lastActivityAt: number;
  activeSessionId?: string;
  memory: string;
}

export interface TangentSession {
  id: string;
  projectId: string;
  createdAt: number;
  openingPrompt?: string;
}

type BacklogStatus = "open" | "in_progress" | "done";

export interface TangentBacklogItem {
  id: string;
  projectId: string;
  title: string;
  body: string;
  status: BacklogStatus;
  order: number;
  createdAt: number;
}

export type TangentResourceType = "run" | "pipeline";

export interface TangentResource {
  id: string;
  projectId: string;
  type: TangentResourceType;
  /** Run URL, or `pipeline://<fileId>` for a locally-stored draft. */
  url: string;
  name: string;
  description: string;
  createdAt: number;
}

export type TangentResourceInput = Omit<
  TangentResource,
  "id" | "projectId" | "createdAt"
>;
