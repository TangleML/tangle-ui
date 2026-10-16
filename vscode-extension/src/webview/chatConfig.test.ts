import assert from "node:assert/strict";
import { test } from "node:test";

import {
  embedEndpoints,
  isChatWebviewConfig,
  isThemeMessage,
} from "./chatConfig.ts";

test("embed endpoints for a Shell at the origin root", () => {
  assert.deepEqual(embedEndpoints("http://127.0.0.1:4000"), {
    channelUrl: "http://127.0.0.1:4000/embed/v1/tangent-elements.js",
    socketUrl: "http://127.0.0.1:4000",
    socketPath: "/socket.io",
  });
});

test("a Shell path prefix moves into the socket path", () => {
  assert.deepEqual(embedEndpoints("http://127.0.0.1:4000/tangent/"), {
    channelUrl: "http://127.0.0.1:4000/tangent/embed/v1/tangent-elements.js",
    socketUrl: "http://127.0.0.1:4000",
    socketPath: "/tangent/socket.io",
  });
});

test("chat config guard requires every field", () => {
  const config = {
    embedBaseUrl: "http://127.0.0.1:4000",
    sessionId: "s1",
    colorScheme: "dark",
    authToken: "header.payload.",
  };
  assert.equal(isChatWebviewConfig(config), true);
  assert.equal(isChatWebviewConfig({ ...config, colorScheme: "blue" }), false);
  assert.equal(isChatWebviewConfig({ ...config, sessionId: 1 }), false);
  assert.equal(isChatWebviewConfig({ ...config, authToken: 1 }), false);
  assert.equal(isChatWebviewConfig(null), false);
});

test("theme message guard", () => {
  assert.equal(isThemeMessage({ type: "theme", colorScheme: "light" }), true);
  assert.equal(isThemeMessage({ type: "theme" }), false);
  assert.equal(isThemeMessage({ type: "error", colorScheme: "dark" }), false);
  assert.equal(isThemeMessage("theme"), false);
});
