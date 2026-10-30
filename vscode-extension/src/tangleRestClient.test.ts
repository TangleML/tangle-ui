import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  collectPages,
  normalizeBaseUrl,
  TangleRestClient,
} from "./tangleRestClient.ts";

interface RecordedRequest {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

const originalFetch = globalThis.fetch;

const sessionResource = {
  id: "res1",
  project_id: "p1",
  entity: "agent_session",
  name: "Debug churn",
  entity_id: "s1",
  data: null,
  created_by: "dev@localhost",
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-02T10:00:00Z",
};

function recordRequest(input: unknown, init?: RequestInit): RecordedRequest {
  return {
    url: new URL(String(input)),
    method: init?.method ?? "GET",
    headers: Object.fromEntries(new Headers(init?.headers).entries()),
    body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
  };
}

function mockFetch(body: unknown, status = 200): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push(recordRequest(input, init));
    const payload = status === 204 ? null : JSON.stringify(body);
    return new Response(payload, { status });
  };
  return requests;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("listProjects maps the page and sends the page size and token", async () => {
  const requests = mockFetch({
    projects: [
      {
        id: "p1",
        workspace_id: "w1",
        name: "Churn model",
        description: null,
        created_by: "dev@localhost",
        updated_at: "2026-09-28T18:50:48Z",
        resource_counts: { pipeline: 2 },
      },
    ],
    total_count: 1,
    next_page_token: "next",
  });

  const page = await new TangleRestClient("http://api.test/").listProjects(
    "tok",
  );

  assert.equal(requests[0].url.pathname, "/api/projects/");
  assert.equal(requests[0].url.searchParams.get("page_token"), "tok");
  assert.equal(requests[0].url.searchParams.get("page_size"), "50");
  assert.equal(page.nextPageToken, "next");
  assert.deepEqual(page.items[0], {
    id: "p1",
    name: "Churn model",
    description: null,
    createdBy: "dev@localhost",
    updatedAt: new Date("2026-09-28T18:50:48Z"),
    resourceCounts: { pipeline: 2 },
  });
});

test("listProjectRuns maps runs and tolerates missing fields", async () => {
  const requests = mockFetch({
    runs: [
      {
        id: "r1",
        root_execution_id: "e1",
        created_by: null,
        created_at: null,
        pipeline_name: null,
      },
    ],
  });

  const page = await new TangleRestClient("http://api.test").listProjectRuns(
    "p/1",
  );

  assert.equal(requests[0].url.pathname, "/api/projects/p%2F1/runs");
  assert.equal(page.nextPageToken, null);
  assert.deepEqual(page.items, [
    {
      id: "r1",
      rootExecutionId: "e1",
      pipelineName: null,
      createdBy: null,
      createdAt: null,
    },
  ]);
});

test("getRunStats asks for execution stats and sends the bearer token", async () => {
  const requests = mockFetch({
    id: "r1",
    execution_status_stats: { SUCCEEDED: 3, FAILED: 1 },
  });

  const stats = await new TangleRestClient(
    "http://api.test",
    "secret",
  ).getRunStats("r1");

  assert.equal(requests[0].url.pathname, "/api/pipeline_runs/r1");
  assert.equal(
    requests[0].url.searchParams.get("include_execution_stats"),
    "true",
  );
  assert.equal(requests[0].headers.authorization, "Bearer secret");
  assert.deepEqual(stats, { SUCCEEDED: 3, FAILED: 1 });
});

test("getProject maps a single project", async () => {
  const requests = mockFetch({
    id: "p 1",
    name: "Churn model",
    resource_counts: null,
  });

  const project = await new TangleRestClient("http://api.test").getProject(
    "p 1",
  );

  assert.equal(requests[0].url.pathname, "/api/projects/p%201");
  assert.equal(project.name, "Churn model");
  assert.deepEqual(project.resourceCounts, {});
});

test("listResources repeats the entity filter and maps rows", async () => {
  const requests = mockFetch({
    resources: [sessionResource],
    total_count: 1,
    next_page_token: null,
  });

  const page = await new TangleRestClient("http://api.test").listResources(
    "p1",
    { entity: ["pipeline", "document"] },
  );

  assert.equal(requests[0].url.pathname, "/api/projects/p1/resources/");
  assert.deepEqual(requests[0].url.searchParams.getAll("entity"), [
    "pipeline",
    "document",
  ]);
  assert.equal(page.nextPageToken, null);
  assert.deepEqual(page.items[0], {
    id: "res1",
    entity: "agent_session",
    name: "Debug churn",
    entityId: "s1",
    metadata: null,
    createdBy: "dev@localhost",
    createdAt: new Date("2026-10-01T10:00:00Z"),
    updatedAt: new Date("2026-10-02T10:00:00Z"),
  });
});

test("createResource posts a session reference as JSON", async () => {
  const requests = mockFetch(sessionResource, 201);

  const resource = await new TangleRestClient(
    "http://api.test",
    "secret",
  ).createResource("p1", {
    entity: "agent_session",
    entityId: "s1",
    name: "Debug churn",
  });

  assert.equal(requests[0].method, "POST");
  assert.equal(requests[0].headers["content-type"], "application/json");
  assert.equal(requests[0].headers.authorization, "Bearer secret");
  assert.deepEqual(requests[0].body, {
    entity: "agent_session",
    entity_id: "s1",
    name: "Debug churn",
  });
  assert.equal(resource.entityId, "s1");
});

test("renameResource patches only the name", async () => {
  const requests = mockFetch({ ...sessionResource, name: "Renamed" });

  const resource = await new TangleRestClient("http://api.test").renameResource(
    "p1",
    "res1",
    "Renamed",
  );

  assert.equal(requests[0].method, "PATCH");
  assert.equal(requests[0].url.pathname, "/api/projects/p1/resources/res1");
  assert.deepEqual(requests[0].body, { name: "Renamed" });
  assert.equal(resource.name, "Renamed");
});

test("deleteResource accepts an empty 204", async () => {
  const requests = mockFetch(null, 204);

  await new TangleRestClient("http://api.test").deleteResource("p1", "res1");

  assert.equal(requests[0].method, "DELETE");
  assert.equal(requests[0].url.pathname, "/api/projects/p1/resources/res1");
});

test("collectPages follows tokens and stops at the page cap", async () => {
  const tokens: (string | undefined)[] = [];
  const items = await collectPages(async (pageToken) => {
    tokens.push(pageToken);
    return { items: [tokens.length], nextPageToken: `t${tokens.length}` };
  }, 3);

  assert.deepEqual(items, [1, 2, 3]);
  assert.deepEqual(tokens, [undefined, "t1", "t2"]);
});

test("failed responses surface the status and body", async () => {
  mockFetch({ detail: "Not found" }, 404);

  await assert.rejects(
    new TangleRestClient("http://api.test").getRunStats("missing"),
    /GET \/api\/pipeline_runs\/missing failed \(404\)/,
  );
});

test("network failures name the API it could not reach", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };

  await assert.rejects(
    new TangleRestClient("http://api.test/").listProjects(),
    /Cannot reach the Tangle API at http:\/\/api\.test/,
  );
});

test("attaches the OktaSSO cookie and retries once after a 401", async () => {
  const requests: RecordedRequest[] = [];
  const forceRefresh: boolean[] = [];
  let call = 0;
  globalThis.fetch = async (input, init) => {
    requests.push(recordRequest(input, init));
    call += 1;
    if (call === 1) return new Response("unauthorized", { status: 401 });
    return new Response(
      JSON.stringify({ id: "r1", execution_status_stats: { SUCCEEDED: 1 } }),
      { status: 200 },
    );
  };
  const cookieProvider = async (options?: { forceRefresh?: boolean }) => {
    forceRefresh.push(Boolean(options?.forceRefresh));
    return options?.forceRefresh ? "SSO_TOKEN=fresh" : "SSO_TOKEN=stale";
  };

  const stats = await new TangleRestClient(
    "http://api.test",
    undefined,
    cookieProvider,
  ).getRunStats("r1");

  assert.deepEqual(stats, { SUCCEEDED: 1 });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].headers.cookie, "SSO_TOKEN=stale");
  assert.equal(requests[1].headers.cookie, "SSO_TOKEN=fresh");
  assert.deepEqual(forceRefresh, [false, true]);
});

test("normalizeBaseUrl drops trailing slashes and rejects other schemes", () => {
  assert.equal(
    normalizeBaseUrl(" http://localhost:8000/ "),
    "http://localhost:8000",
  );
  assert.throws(() => normalizeBaseUrl("ftp://host"), /http/);
  assert.throws(() => normalizeBaseUrl("not a url"));
});
