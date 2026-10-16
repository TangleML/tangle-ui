import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { cookieAwareMint } from "./remoteEnvTokenMint.ts";

interface RecordedRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function loginPage(): Response {
  return new Response("<!DOCTYPE html><html>login</html>", {
    status: 200,
    headers: { "content-type": "text/html" },
  });
}

function tokenJson(): Response {
  return new Response(
    JSON.stringify({
      token: "scoped-token",
      environmentId: "env-1",
      expiresAt: "2026-10-23T00:00:00Z",
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

test("refreshes the cookie and retries when the gate returns a login page", async () => {
  const requests: RecordedRequest[] = [];
  const forceRefresh: boolean[] = [];
  let call = 0;
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    call += 1;
    return call === 1 ? loginPage() : tokenJson();
  };
  const cookieProvider = async (options?: { forceRefresh?: boolean }) => {
    forceRefresh.push(Boolean(options?.forceRefresh));
    return options?.forceRefresh
      ? "MINERVA_TOKEN=fresh"
      : "MINERVA_TOKEN=stale";
  };

  const token = await cookieAwareMint(cookieProvider)({
    shellUrl: "http://shell.test/",
    selector: "projectId:p1",
    email: "dev@localhost",
  });

  assert.deepEqual(token, {
    token: "scoped-token",
    environmentId: "env-1",
    expiresAtMs: Date.parse("2026-10-23T00:00:00Z"),
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "http://shell.test/api/embed/remote-env-token");
  assert.equal(requests[0].headers.cookie, "MINERVA_TOKEN=stale");
  assert.equal(requests[1].headers.cookie, "MINERVA_TOKEN=fresh");
  assert.deepEqual(requests[1].body, { selector: "projectId:p1" });
  assert.deepEqual(forceRefresh, [false, true]);
});

test("passes the cookie on the first try when the gate accepts it", async () => {
  const requests: RecordedRequest[] = [];
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: undefined,
    });
    return tokenJson();
  };

  const token = await cookieAwareMint(async () => "MINERVA_TOKEN=ok")({
    shellUrl: "http://shell.test",
    selector: "projectId:p1",
    email: "dev@localhost",
    environmentId: "env-pinned",
  });

  assert.equal(token.environmentId, "env-1");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].headers.cookie, "MINERVA_TOKEN=ok");
});
