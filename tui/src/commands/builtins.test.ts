import assert from "node:assert/strict";
import { test } from "node:test";

import { COMMANDS, findCommand, parseCommand } from "./builtins.ts";

test("parseCommand splits a slash command into name and args", () => {
  assert.deepEqual(parseCommand("/web foo bar"), {
    name: "web",
    args: ["foo", "bar"],
  });
  assert.deepEqual(parseCommand("/help"), { name: "help", args: [] });
});

test("parseCommand returns null for a plain chat message", () => {
  assert.equal(parseCommand("hello there"), null);
  assert.equal(parseCommand("  not a command"), null);
});

test("every built-in command is resolvable by name", () => {
  for (const command of COMMANDS) {
    assert.equal(findCommand(command.name), command);
  }
  assert.equal(findCommand("does-not-exist"), undefined);
});
