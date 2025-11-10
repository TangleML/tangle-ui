import type { JWTPayload } from "../Authentication/types";

// resolved at runtime to support testing
export const isHuggingFaceAuthEnabled = () =>
  import.meta.env.VITE_HUGGING_FACE_AUTHORIZATION === "true";

export const HUGGING_FACE_DEFAULT_JWT: Pick<
  JWTPayload,
  "original_token" | "auth_provider"
> = {
  original_token: "authorized-by-huggingface-nonce",
  auth_provider: "huggingface",
};
