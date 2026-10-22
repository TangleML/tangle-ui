import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

import type { BodyCreateApiPipelineRunsPost } from "@/api/types.gen";

import {
  cancelPipelineRun,
  createPipelineRun,
  updateRunAnnotation,
} from "./pipelineRunService";

const BACKEND_URL = "https://api.example.com";
const PAYLOAD = {} as BodyCreateApiPipelineRunsPost;

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("createPipelineRun", () => {
  let mockFetch: Mock;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the created run", async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, { id: 123 }));

    await expect(createPipelineRun(PAYLOAD, BACKEND_URL)).resolves.toEqual({
      id: 123,
    });
  });

  it("rejects with the reason the backend gave", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(422, {
        detail:
          "Accelerator H200 is not offered by cluster B300 cluster. Select one of: B300-SXM6-PC.",
        code: "accelerator_not_offered",
        successor: null,
      }),
    );

    await expect(createPipelineRun(PAYLOAD, BACKEND_URL)).rejects.toThrow(
      "Accelerator H200 is not offered by cluster B300 cluster. Select one of: B300-SXM6-PC.",
    );
  });

  it("rejects with a message-shaped reason too", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(403, { message: "Access denied" }),
    );

    await expect(createPipelineRun(PAYLOAD, BACKEND_URL)).rejects.toThrow(
      "Access denied",
    );
  });

  /** An unreadable `detail` is still the server's own words: hand them over. */
  it("passes on a body it cannot read as a reason", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(500, { detail: { loc: ["body"] } }),
    );

    await expect(createPipelineRun(PAYLOAD, BACKEND_URL)).rejects.toThrow(
      'Failed to create pipeline run (500): {"detail":{"loc":["body"]}}',
    );
  });

  it("keeps a body that is not JSON", async () => {
    mockFetch.mockResolvedValue(
      new Response("<html>502 Bad Gateway</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      }),
    );

    await expect(createPipelineRun(PAYLOAD, BACKEND_URL)).rejects.toThrow(
      "<html>502 Bad Gateway</html>",
    );
  });
});

describe("changing a run", () => {
  let mockFetch: Mock;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects a cancel with the reason the backend gave", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(403, { detail: "Only the run's creator can cancel it." }),
    );

    await expect(cancelPipelineRun("42", BACKEND_URL)).rejects.toThrow(
      "Failed to cancel the run (403): Only the run's creator can cancel it.",
    );
  });

  it("rejects an annotation with the reason the backend gave", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse(403, { detail: "Only the run's creator can annotate it." }),
    );

    await expect(
      updateRunAnnotation("42", BACKEND_URL, { key: "notes", value: "Hi" }),
    ).rejects.toThrow(
      "Failed to save the run's notes (403): Only the run's creator can annotate it.",
    );
  });
});

describe("acting as a team", () => {
  const TEAM_ID = "ml-team@project.iam.gserviceaccount.com";
  const HEADER_NAME = "x-tangle-impersonate-team-id";
  let mockFetch: Mock;

  const sentHeaders = () => {
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    return init.headers;
  };

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, { id: 123 }));
    global.fetch = mockFetch;
    window.__TANGLE_TEAM_IMPERSONATION__ = { headerName: HEADER_NAME };
  });

  afterEach(() => {
    delete window.__TANGLE_TEAM_IMPERSONATION__;
    vi.restoreAllMocks();
  });

  it("creates the run as the team", async () => {
    await createPipelineRun(PAYLOAD, BACKEND_URL, "token", TEAM_ID);

    expect(sentHeaders()).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer token",
      [HEADER_NAME]: TEAM_ID,
    });
  });

  it("creates the run as the user without a team", async () => {
    await createPipelineRun(PAYLOAD, BACKEND_URL);

    expect(sentHeaders()).toEqual({ "Content-Type": "application/json" });
  });

  it("cancels the run as the team", async () => {
    await cancelPipelineRun("42", BACKEND_URL, TEAM_ID);

    expect(mockFetch).toHaveBeenCalledWith(
      `${BACKEND_URL}/api/pipeline_runs/42/cancel`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(sentHeaders()).toEqual({ [HEADER_NAME]: TEAM_ID });
  });

  it("sets an annotation as the team", async () => {
    await updateRunAnnotation(
      "42",
      BACKEND_URL,
      { key: "notes", value: "Rerun with more memory" },
      TEAM_ID,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      `${BACKEND_URL}/api/pipeline_runs/42/annotations/notes?value=Rerun+with+more+memory`,
      expect.objectContaining({ method: "PUT" }),
    );
    expect(sentHeaders()).toEqual({ [HEADER_NAME]: TEAM_ID });
  });
});
