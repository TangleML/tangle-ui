type AuthProvider = "github" | "minerva" | "huggingface";

export interface OasisAuthResponse {
  token: string;
  token_type: "JWT";
}

export interface JwtAuthStorage {
  jwtToken: JWTPayload | undefined;
}

export interface JWTPayload {
  access_token: string;
  original_token: string;

  auth_provider: AuthProvider | undefined;

  user_id: string;
  login: string;
  avatar_url: string;

  exp: number;
}
