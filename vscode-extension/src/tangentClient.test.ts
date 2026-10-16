import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { TangentClient } from "./tangentClient.ts";

interface RecordedRequest {
  url: string;
  headers: Record<string, string>;
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("attaches the OktaSSO cookie and retries once after a 401", async () => {
  const requests: RecordedRequest[] = [];
  const forceRefresh: boolean[] = [];
  let call = 0;
  globalThis.fetch = async (input, init) => {
    requests.push({
      url: String(input),
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
    });
    call += 1;
    if (call === 1) return new Response("unauthorized", { status: 401 });
    return new Response(
      JSON.stringify({ session: { id: "s1", name: "Debug" } }),
      { status: 200 },
    );
  };
  const cookieProvider = async (options?: { forceRefresh?: boolean }) => {
    forceRefresh.push(Boolean(options?.forceRefresh));
    return options?.forceRefresh ? "SSO_TOKEN=fresh" : "SSO_TOKEN=stale";
  };

  const session = await new TangentClient(
    "http://shell.test",
    cookieProvider,
  ).getSession("s1");

  assert.deepEqual(session, { id: "s1", name: "Debug" });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].headers.cookie, "SSO_TOKEN=stale");
  assert.equal(requests[1].headers.cookie, "SSO_TOKEN=fresh");
  assert.deepEqual(forceRefresh, [false, true]);
});
