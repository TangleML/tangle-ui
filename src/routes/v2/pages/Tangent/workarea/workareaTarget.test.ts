import { describe, expect, it } from "vitest";

import type {
  ArtifactTarget,
  PipelineTarget,
  RunTarget,
  WorkareaTarget,
} from "./types";
import {
  formatWorkareaTarget,
  idIdentity,
  isWorkareaTargetString,
  nameIdentity,
  parseIdentity,
  parseWorkareaTarget,
  sameTarget,
} from "./workareaTarget";

describe("workareaTarget", () => {
  it("round-trips between object and string form", () => {
    const target: WorkareaTarget = {
      type: "artifact",
      identity: idIdentity("https://host/a.txt"),
    };

    const asString = formatWorkareaTarget(target);

    expect(asString).toBe("artifact://id/https://host/a.txt");
    expect(parseWorkareaTarget(asString)).toEqual(target);
  });

  it("builds sub-key prefixed identities", () => {
    expect(idIdentity("abc")).toBe("id/abc");
    expect(nameIdentity("My Draft")).toBe("name/My Draft");
  });

  it("splits an identity into its key and value", () => {
    expect(parseIdentity("id/https://host/a")).toEqual({
      key: "id",
      value: "https://host/a",
    });
    expect(parseIdentity("name/My Draft")).toEqual({
      key: "name",
      value: "My Draft",
    });
  });

  it("throws on a target without a separator", () => {
    expect(() => parseWorkareaTarget("no-separator")).toThrow(/Malformed/);
  });

  it("throws on an unsupported target type", () => {
    expect(() => parseWorkareaTarget("bogus://id/x")).toThrow(/Unsupported/);
  });

  it("throws on an identity without a sub-key prefix", () => {
    expect(() => parseWorkareaTarget("run://run-123")).toThrow(/identity/);
  });

  it("rejects a name identity for types that only accept an id", () => {
    expect(() => parseWorkareaTarget("run://name/foo")).toThrow(/identity/);
    expect(() => parseWorkareaTarget("artifact://name/foo")).toThrow(
      /identity/,
    );
  });

  it("compares targets by type and identity", () => {
    const target: WorkareaTarget = { type: "run", identity: idIdentity("1") };

    expect(sameTarget(target, { type: "run", identity: idIdentity("1") })).toBe(
      true,
    );
    expect(sameTarget(target, { type: "run", identity: idIdentity("2") })).toBe(
      false,
    );
    expect(
      sameTarget(target, { type: "pipeline", identity: idIdentity("1") }),
    ).toBe(false);
  });

  it("recognizes canonical target strings", () => {
    expect(isWorkareaTargetString("artifact://id/https://host/a.txt")).toBe(
      true,
    );
    expect(isWorkareaTargetString("pipeline://name/My Draft")).toBe(true);
    expect(isWorkareaTargetString("pipeline://id/p1")).toBe(true);
    expect(isWorkareaTargetString("run://id/1")).toBe(true);
  });

  it("rejects malformed target strings", () => {
    expect(isWorkareaTargetString("no-separator")).toBe(false);
    expect(isWorkareaTargetString("bogus://id/x")).toBe(false);
    expect(isWorkareaTargetString("run://run-123")).toBe(false);
  });

  it("builds each target kind from its concrete type", () => {
    const artifact: ArtifactTarget = {
      type: "artifact",
      identity: idIdentity("a.txt"),
    };
    const pipelineById: PipelineTarget = {
      type: "pipeline",
      identity: idIdentity("p1"),
    };
    const pipelineByName: PipelineTarget = {
      type: "pipeline",
      identity: nameIdentity("Draft"),
    };
    const run: RunTarget = { type: "run", identity: idIdentity("1") };

    expect(formatWorkareaTarget(artifact)).toBe("artifact://id/a.txt");
    expect(formatWorkareaTarget(pipelineByName)).toBe("pipeline://name/Draft");
    expect(sameTarget(pipelineById, run)).toBe(false);
  });
});
