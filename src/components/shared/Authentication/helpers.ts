import { JWTPayloadSchema } from "@/schemas/api";
import { env } from "@/schemas/env";

import type { JWTPayload } from "./types";

export function isAuthorizationRequired() {
  return env.VITE_REQUIRE_AUTHORIZATION;
}

export function readJWT(token: string): Omit<JWTPayload, "original_token"> {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(""),
  );

  return JWTPayloadSchema.parse(JSON.parse(jsonPayload));
}

export function convertJWTToJWTPayload(token: string): JWTPayload {
  const payload = readJWT(token);

  return {
    original_token: token,
    ...payload,
  } satisfies JWTPayload;
}
