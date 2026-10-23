import assert from "node:assert/strict";
import { test } from "node:test";

import { chatContentSecurityPolicy, chatPageHtml } from "./chatHtml.ts";

const PAGE = {
  cspSource: "https://webview.test",
  scriptUri: "https://webview.test/dist/chat.js",
  nonce: "abc123",
  embedOrigin: "http://127.0.0.1:4000",
  config: {
    embedBaseUrl: "http://127.0.0.1:4000",
    sessionId: "s1",
    colorScheme: "dark" as const,
    authToken: "header.payload.",
  },
};

function directives(csp: string): Map<string, string> {
  return new Map(
    csp.split("; ").map((directive) => {
      const [name = "", ...sources] = directive.split(" ");
      return [name, sources.join(" ")];
    }),
  );
}

test("the CSP limits scripts to the nonce, the webview, and the embed origin", () => {
  const csp = directives(chatContentSecurityPolicy(PAGE));

  assert.equal(csp.get("default-src"), "'none'");
  assert.equal(
    csp.get("script-src"),
    "'nonce-abc123' https://webview.test http://127.0.0.1:4000",
  );
  assert.equal(
    csp.get("connect-src"),
    "http://127.0.0.1:4000 ws://127.0.0.1:4000",
  );
  assert.equal(csp.get("worker-src"), "http://127.0.0.1:4000 blob:");
});

test("an https embed origin allows a secure socket", () => {
  const csp = directives(
    chatContentSecurityPolicy({ ...PAGE, embedOrigin: "https://shell.test" }),
  );
  assert.equal(csp.get("connect-src"), "https://shell.test wss://shell.test");
});

test("the page loads the bundle with the nonce and embeds the config", () => {
  const html = chatPageHtml(PAGE);

  assert.match(
    html,
    /<script type="module" nonce="abc123" src="https:\/\/webview\.test\/dist\/chat\.js">/,
  );
  assert.match(html, /"sessionId":"s1"/);
});

test("config values cannot close the JSON script block", () => {
  const html = chatPageHtml({
    ...PAGE,
    config: { ...PAGE.config, sessionId: "</script><script>alert(1)" },
  });

  assert.doesNotMatch(html, /<\/script><script>alert/);
  assert.match(html, /\\u003c\/script>\\u003cscript>alert\(1\)/);
});
