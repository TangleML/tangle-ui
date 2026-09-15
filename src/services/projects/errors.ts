export class WorkspacesApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "WorkspacesApiError";
    this.status = status;
  }
}

export class ProjectsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ProjectsApiError";
    this.status = status;
  }
}

export class ProjectResourcesApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ProjectResourcesApiError";
    this.status = status;
  }
}
