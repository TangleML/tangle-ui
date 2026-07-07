import { afterEach, describe, expect, it } from "vitest";

import {
  addSecret,
  fetchSecretsList,
} from "@/components/shared/SecretsManagement/secretsStorage";

import {
  isTourMockActive,
  mockAddSecret,
  mockListSecrets,
  setTourMockActive,
} from "./tourMockBackend";

afterEach(() => {
  // Deactivating clears the in-memory store.
  setTourMockActive(false);
});

describe("tourMockBackend store", () => {
  it("adds and lists secrets while active", () => {
    setTourMockActive(true);
    mockAddSecret("API_KEY", "secret-value");

    const names = mockListSecrets().map((s) => s.name);
    expect(names).toEqual(["API_KEY"]);
  });

  it("clears the store when deactivated", () => {
    setTourMockActive(true);
    mockAddSecret("API_KEY", "secret-value");
    setTourMockActive(false);

    expect(isTourMockActive()).toBe(false);
    expect(mockListSecrets()).toEqual([]);
  });
});

describe("secretsStorage routes to the mock when active", () => {
  it("addSecret + fetchSecretsList use the in-memory store", async () => {
    setTourMockActive(true);

    await addSecret({ name: "TOKEN", value: "v" });
    const listed = await fetchSecretsList();

    expect(listed.map((s) => s.name)).toEqual(["TOKEN"]);
  });
});
