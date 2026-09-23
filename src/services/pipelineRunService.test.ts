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

import { createPipelineRun } from "./pipelineRunService";

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
