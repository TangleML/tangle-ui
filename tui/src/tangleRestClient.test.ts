import assert from "node:assert/strict";
import { test } from "node:test";

import { currentUserEmailOf } from "./tangleRestClient.ts";

test("currentUserEmailOf returns the user's id", () => {
  assert.equal(
    currentUserEmailOf({ id: "me@example.com", permissions: [] }),
    "me@example.com",
  );
});

test("currentUserEmailOf treats an unknown or missing user as no identity", () => {
  assert.equal(
    currentUserEmailOf({ id: "Unknown", permissions: [] }),
    undefined,
  );
  assert.equal(currentUserEmailOf({ id: null, permissions: [] }), undefined);
  assert.equal(currentUserEmailOf({ id: "  " }), undefined);
  assert.equal(currentUserEmailOf(null), undefined);
});

test("currentUserEmailOf rejects a malformed body", () => {
  assert.equal(currentUserEmailOf({ id: 42 }), undefined);
  assert.equal(currentUserEmailOf("me@example.com"), undefined);
});
