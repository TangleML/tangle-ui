export class ApiError extends Error {
  readonly status: number;

  constructor(name: string, message: string, status: number) {
    super(message);
    this.name = name;
    this.status = status;
  }
}

export class WorkspacesApiError extends ApiError {
  constructor(message: string, status: number) {
    super("WorkspacesApiError", message, status);
  }
}

export class ProjectsApiError extends ApiError {
  constructor(message: string, status: number) {
    super("ProjectsApiError", message, status);
  }
}

export class ProjectResourcesApiError extends ApiError {
  constructor(message: string, status: number) {
    super("ProjectResourcesApiError", message, status);
  }
}

export class ProjectRunsApiError extends ApiError {
  constructor(message: string, status: number) {
    super("ProjectRunsApiError", message, status);
  }
}

const NOT_FOUND = 404;

/**
 * A project that answers nothing is not an error to report: attribution and
 * links outlive the projects they name, and nobody can act on one that has
 * been deleted. Teach an archived project the same answer here.
 */
export function isProjectGone(error: unknown): boolean {
  return error instanceof ProjectsApiError && error.status === NOT_FOUND;
}
