import { describe, expect, it } from "vitest";

import { readJWT } from "@/components/shared/Authentication/helpers";

import { createUnsignedJwt } from "./createUnsignedJwt";

describe("createUnsignedJwt", () => {
  it("round-trips claims through readJWT", () => {
    const token = createUnsignedJwt({ email: "user@example.com" });

    expect(readJWT(token)).toEqual({ email: "user@example.com" });
  });

  it("emits an alg:none header and an empty signature segment", () => {
    const token = createUnsignedJwt({ email: "user@example.com" });
    const [header, , signature] = token.split(".");

    expect(JSON.parse(atob(header))).toEqual({ alg: "none", typ: "JWT" });
    expect(signature).toBe("");
  });

  it("preserves non-ASCII characters in claims", () => {
    const token = createUnsignedJwt({ email: "üser@exämple.com" });

    expect(readJWT(token)).toEqual({ email: "üser@exämple.com" });
  });
});
