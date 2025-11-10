import { describe, expect, it } from "vitest";

import { convertJWTToJWTPayload, readJWT } from "../helpers";
import type { JWTPayload } from "../types";

const mockedJWTHeader = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
const mockedJWTSignature = "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

describe("readJWT", () => {
  it("should decode a valid JWT token and return the payload", () => {
    // Create a mock JWT payload
    const mockPayload = {
      user_id: "123",
      login: "testuser",
      avatar_url: "https://example.com/avatar.jpg",
      auth_provider: "github",
      exp: 1234567890,
    };

    // Encode the payload as base64
    const base64Payload = btoa(JSON.stringify(mockPayload));
    // Create a mock JWT token (header.payload.signature)
    const mockToken = `${mockedJWTHeader}.${base64Payload}.${mockedJWTSignature}`;

    const result = readJWT(mockToken);

    expect(result).toEqual(mockPayload);
  });

  it("should throw an error for invalid JWT token format", () => {
    const invalidToken = "invalid.token";

    expect(() => readJWT(invalidToken)).toThrow();
  });

  it("should throw an error for invalid base64 encoding", () => {
    const invalidToken = "header.invalidbase64!@#.signature";

    expect(() => readJWT(invalidToken)).toThrow();
  });

  it("should throw an error for invalid JSON in payload", () => {
    // Create invalid JSON by encoding a malformed string
    const invalidJson = "invalid json content";
    const base64Payload = btoa(invalidJson);
    const mockToken = `${mockedJWTHeader}.${base64Payload}.${mockedJWTSignature}`;

    expect(() => readJWT(mockToken)).toThrow();
  });
});

describe("convertJWTToJWTPayload", () => {
  it("should convert JWT token to JWTPayload with original_token included", () => {
    const mockPayload = {
      user_id: "123",
      login: "testuser",
      avatar_url: "https://example.com/avatar.jpg",
      auth_provider: "github" as const,
      exp: 1234567890,
    };

    const base64Payload = btoa(JSON.stringify(mockPayload));
    const mockToken = `${mockedJWTHeader}.${base64Payload}.${mockedJWTSignature}`;

    const result = convertJWTToJWTPayload(mockToken);

    const expectedPayload: JWTPayload = {
      original_token: mockToken,
      ...mockPayload,
    };

    expect(result).toEqual(expectedPayload);
  });
});
