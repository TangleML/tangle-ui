import assert from "node:assert/strict";
import { test } from "node:test";

import { emailFromSessionCookie } from "./oktaSsoIdentity.ts";

const COOKIE_NAME = "MINERVA_TOKEN";

function jwt(claims: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.`;
}

function cookie(value: string): string {
  return `${COOKIE_NAME}=${value}`;
}

test("reads the email claim from the session JWT", () => {
  const header = cookie(jwt({ email: "real.user@corp.example" }));
  assert.equal(
    emailFromSessionCookie(header, COOKIE_NAME),
    "real.user@corp.example",
  );
});

test("finds the cookie among several", () => {
  const header = `other=x; ${cookie(jwt({ email: "a@b.com" }))}; last=y`;
  assert.equal(emailFromSessionCookie(header, COOKIE_NAME), "a@b.com");
});

test("returns undefined when the JWT omits email", () => {
  const header = cookie(jwt({ sub: "123" }));
  assert.equal(emailFromSessionCookie(header, COOKIE_NAME), undefined);
});

test("returns undefined when email is an empty string", () => {
  const header = cookie(jwt({ email: "" }));
  assert.equal(emailFromSessionCookie(header, COOKIE_NAME), undefined);
});

test("returns undefined for an opaque, non-JWT cookie value", () => {
  assert.equal(
    emailFromSessionCookie(cookie("opaque-session-token"), COOKIE_NAME),
    undefined,
  );
});

test("returns undefined when the cookie name is absent", () => {
  const header = cookie(jwt({ email: "a@b.com" }));
  assert.equal(emailFromSessionCookie(header, "OTHER_COOKIE"), undefined);
});

test("returns undefined when the JWT payload is malformed", () => {
  const header = cookie("header.not-base64-json!!.signature");
  assert.equal(emailFromSessionCookie(header, COOKIE_NAME), undefined);
});
