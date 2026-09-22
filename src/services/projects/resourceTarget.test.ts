import { describe, expect, it } from "vitest";

import type {
  ArtifactTarget,
  DocumentTarget,
  PipelineTarget,
  RunTarget,
  WorkareaTarget,
} from "./resourceTarget";
import {
  formatWorkareaTarget,
  idIdentity,
  isWorkareaTargetString,
  nameIdentity,
  parseIdentity,
  parseWorkareaTarget,
  sameTarget,
} from "./resourceTarget";

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
    expect(() => parseWorkareaTarget("document://name/foo")).toThrow(
      /identity/,
    );
  });

  it("addresses a document by the row that is the document", () => {
    expect(parseWorkareaTarget("document://id/resource-7")).toEqual({
      type: "document",
      identity: "id/resource-7",
    });
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

  /**
   * Only a pipeline can be addressed by name. Passing this guard has to mean
   * the parse will succeed, or a caller told the string was fine crashes on it.
   */
  it("rejects a kind addressed by an identity it cannot take", () => {
    expect(isWorkareaTargetString("run://name/x")).toBe(false);
    expect(isWorkareaTargetString("artifact://name/x")).toBe(false);
  });

  it("agrees with the parser on everything it accepts", () => {
    const candidates = [
      "pipeline://id/p1",
      "pipeline://name/Draft",
      "run://id/1",
      "run://name/x",
      "artifact://id/a.txt",
      "artifact://name/a.txt",
      "document://id/r1",
      "document://name/r1",
      "bogus://id/x",
      "run://run-123",
    ];

    for (const raw of candidates) {
      const accepted = isWorkareaTargetString(raw);
      let parses = true;
      try {
        parseWorkareaTarget(raw);
      } catch {
        parses = false;
      }
      expect(accepted, `guard and parser disagree about ${raw}`).toBe(parses);
    }
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
    const document: DocumentTarget = {
      type: "document",
      identity: idIdentity("r1"),
    };

    expect(formatWorkareaTarget(artifact)).toBe("artifact://id/a.txt");
    expect(formatWorkareaTarget(document)).toBe("document://id/r1");
    expect(formatWorkareaTarget(pipelineByName)).toBe("pipeline://name/Draft");
    expect(sameTarget(pipelineById, run)).toBe(false);
  });
});
