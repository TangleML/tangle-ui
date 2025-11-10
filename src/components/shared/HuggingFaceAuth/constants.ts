// resolved during build time
export const HF_AUTH_ENABLED =
  import.meta.env.VITE_HUGGING_FACE_AUTHORIZATION === "true";
