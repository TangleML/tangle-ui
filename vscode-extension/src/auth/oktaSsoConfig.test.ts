import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { getOktaSsoConfig, isOktaSsoEnabled } from "./oktaSsoConfig.ts";

const KEYS = [
  "VITE_OKTASSO_ENABLED",
  "VITE_OKTASSO_OAUTH_ENDPOINT_BASE",
  "VITE_OKTASSO_TOKEN_EXCHANGE_URL",
  "VITE_OKTASSO_CLIENT_ID",
  "VITE_OKTASSO_TOKEN_COOKIE_NAME",
  "VITE_OKTASSO_SCOPES",
  "VITE_OKTASSO_REDIRECT_URI",
  "VITE_OKTASSO_CALLBACK_PORT",
  "VITE_OKTASSO_REFRESH_AFTER_MS",
];

function clearEnv(): void {
  for (const key of KEYS) delete process.env[key];
}

function configureRequired(): void {
  process.env.VITE_OKTASSO_OAUTH_ENDPOINT_BASE = "https://okta.example/oauth2/";
  process.env.VITE_OKTASSO_TOKEN_EXCHANGE_URL = "https://sso.example/token";
  process.env.VITE_OKTASSO_CLIENT_ID = "client-id";
  process.env.VITE_OKTASSO_TOKEN_COOKIE_NAME = "SSO_TOKEN";
}

afterEach(clearEnv);

test("stays disabled when the required values are missing", () => {
  clearEnv();
  assert.equal(isOktaSsoEnabled(), false);
});

test("turns on once the four required values are present", () => {
  clearEnv();
  configureRequired();
  assert.equal(isOktaSsoEnabled(), true);
});

test("the kill switch disables the gate even when configured", () => {
  clearEnv();
  configureRequired();
  process.env.VITE_OKTASSO_ENABLED = "false";
  assert.equal(isOktaSsoEnabled(), false);
});

test("falls back to the documented defaults for optional settings", () => {
  clearEnv();
  const config = getOktaSsoConfig();
  assert.equal(config.scopes, "profile email openid");
  assert.equal(config.redirectUri, "http://localhost:3001/auth");
  assert.equal(config.callbackPort, 3001);
  assert.equal(config.refreshAfterMs, 3_300_000);
});
