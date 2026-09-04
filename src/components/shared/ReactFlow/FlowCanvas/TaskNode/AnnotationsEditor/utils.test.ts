import { beforeEach, describe, expect, it, vi } from "vitest";

import { isFlagEnabled } from "@/components/shared/Settings/useFlags";

import {
  getCloudProviderConfig,
  getProviderSchema,
  parseSchemaToAnnotationConfig,
  resolveLauncherKey,
} from "./utils";

vi.mock("@/components/shared/Settings/useFlags", () => ({
  isFlagEnabled: vi.fn(),
}));

const CLOUD_PROVIDER_ANNOTATION =
  "cloud-pipelines.net/orchestration/cloud_provider";

const makeSchema = (
  launchers: Record<string, Record<string, unknown>>,
  cloudProvider: Record<string, unknown> = {},
) => ({
  cloud_provider: {
    type: "string",
    annotation: CLOUD_PROVIDER_ANNOTATION,
    ...cloudProvider,
  },
  launcher_annotation_schemas: Object.fromEntries(
    Object.entries(launchers).map(([key, extra]) => [
      key,
      { type: "object", properties: {}, ...extra },
    ]),
  ),
});

beforeEach(() => {
  vi.mocked(isFlagEnabled).mockReturnValue(true);
});

describe("getCloudProviderConfig", () => {
  it("returns null when cloud_provider or launcher schemas are missing", () => {
    expect(getCloudProviderConfig({ launcher_annotation_schemas: {} })).toBe(
      null,
    );
    expect(
      getCloudProviderConfig({
        cloud_provider: {
          type: "string",
          annotation: CLOUD_PROVIDER_ANNOTATION,
        },
      }),
    ).toBe(null);
  });

  it("derives options from launcher keys with title as the display name", () => {
    const config = getCloudProviderConfig(
      makeSchema({
        "ml-offline-us-ce1-eo9": { title: "eo9" },
      }),
    );

    expect(config?.annotation).toBe(CLOUD_PROVIDER_ANNOTATION);
    expect(config?.options).toEqual([
      { value: "ml-offline-us-ce1-eo9", name: "eo9" },
    ]);
  });

  it("hides an option when its feature flag is disabled", () => {
    vi.mocked(isFlagEnabled).mockImplementation(
      (flag) => flag !== "eo9-launcher",
    );

    const config = getCloudProviderConfig(
      makeSchema({
        google: { title: "Google Cloud" },
        "ml-offline-us-ce1-eo9": {
          title: "eo9",
          "feature-flag-key": "eo9-launcher",
        },
      }),
    );

    expect(config?.options?.map((o) => o.value)).toEqual(["google"]);
  });

  it("shows a flagged option when its feature flag is enabled", () => {
    vi.mocked(isFlagEnabled).mockReturnValue(true);

    const config = getCloudProviderConfig(
      makeSchema({
        "ml-offline-us-ce1-eo9": {
          title: "eo9",
          "feature-flag-key": "eo9-launcher",
        },
      }),
    );

    expect(config?.options?.map((o) => o.value)).toEqual([
      "ml-offline-us-ce1-eo9",
    ]);
  });

  it("hides an option with x-active false regardless of an enabled flag", () => {
    vi.mocked(isFlagEnabled).mockReturnValue(true);

    const config = getCloudProviderConfig(
      makeSchema({
        google: { title: "Google Cloud" },
        davies: {
          title: "Davies",
          "feature-flag-key": "davies-launcher",
          "x-active": false,
        },
      }),
    );

    expect(config?.options?.map((o) => o.value)).toEqual(["google"]);
  });

  it("requires both x-active and the feature flag to show an option", () => {
    const schema = makeSchema({
      gated: {
        title: "Gated",
        "feature-flag-key": "gated-launcher",
        "x-active": true,
      },
    });

    vi.mocked(isFlagEnabled).mockReturnValue(false);
    expect(getCloudProviderConfig(schema)?.options).toEqual([]);

    vi.mocked(isFlagEnabled).mockReturnValue(true);
    expect(
      getCloudProviderConfig(schema)?.options?.map((o) => o.value),
    ).toEqual(["gated"]);
  });

  it("marks a launcher option deprecated with its message", () => {
    const config = getCloudProviderConfig(
      makeSchema({
        legacy: {
          title: "Legacy",
          "x-deprecated": true,
          "x-deprecated-message": "Use eo9 instead",
        },
      }),
    );

    expect(config?.options?.[0]).toEqual({
      value: "legacy",
      name: "Legacy",
      deprecated: true,
      deprecationMessage: "Use eo9 instead",
    });
  });

  it("populates provider, project, and cluster from x- fields", () => {
    const config = getCloudProviderConfig(
      makeSchema({
        "ml-offline-us-ce1-eo9": {
          title: "eo9",
          "x-provider": "Google GKE",
          "x-project": "shopify-ml-offline-prod",
          "x-cluster": "ml-offline-us-ce1-eo9",
        },
      }),
    );

    expect(config?.options?.[0]).toEqual({
      value: "ml-offline-us-ce1-eo9",
      name: "eo9",
      provider: "Google GKE",
      project: "shopify-ml-offline-prod",
      cluster: "ml-offline-us-ce1-eo9",
    });
  });

  it("carries deprecation through the enum path via x-enum-deprecated", () => {
    const config = getCloudProviderConfig(
      makeSchema(
        { google: {} },
        {
          enum: ["google", "legacy"],
          "x-enum-labels": { legacy: "Legacy" },
          "x-enum-deprecated": { legacy: true },
          "x-enum-deprecated-messages": { legacy: "Being retired" },
        },
      ),
    );

    expect(config?.options).toEqual([
      { value: "google", name: "google" },
      {
        value: "legacy",
        name: "Legacy",
        deprecated: true,
        deprecationMessage: "Being retired",
      },
    ]);
  });
});

describe("parseSchemaToAnnotationConfig", () => {
  it("marks enum options deprecated from x-enum-deprecated", () => {
    const [config] = parseSchemaToAnnotationConfig({
      type: "object",
      properties: {
        tier: {
          type: "string",
          enum: ["standard", "old"],
          "x-enum-deprecated": { old: true },
        },
      },
    });

    expect(config.options).toEqual([
      { value: "standard", name: "standard" },
      { value: "old", name: "old", deprecated: true },
    ]);
  });
});

describe("resolveLauncherKey", () => {
  const schema = makeSchema({
    "ml-offline-us-ce1-lt3": { "x-legacy-keys": ["google"] },
    "ml-offline-us-ce1-eo9": {},
  });

  it("returns a current launcher key unchanged", () => {
    expect(resolveLauncherKey(schema, "ml-offline-us-ce1-lt3")).toBe(
      "ml-offline-us-ce1-lt3",
    );
  });

  it("maps a legacy key to its current launcher key", () => {
    expect(resolveLauncherKey(schema, "google")).toBe("ml-offline-us-ce1-lt3");
  });

  it("returns an unknown value unchanged", () => {
    expect(resolveLauncherKey(schema, "azure")).toBe("azure");
  });

  it("passes through empty or missing values", () => {
    expect(resolveLauncherKey(schema, "")).toBe("");
    expect(resolveLauncherKey(schema, undefined)).toBe(undefined);
    expect(
      resolveLauncherKey({ launcher_annotation_schemas: {} }, "google"),
    ).toBe("google");
  });
});

describe("getProviderSchema", () => {
  const schema = makeSchema({
    "ml-offline-us-ce1-lt3": {
      "x-legacy-keys": ["google"],
      properties: { cpu: { type: "string" } },
    },
  });

  it("resolves a legacy key to the current launcher's schema", () => {
    expect(getProviderSchema(schema, "google")).toBe(
      schema.launcher_annotation_schemas["ml-offline-us-ce1-lt3"],
    );
  });

  it("returns null for an unknown provider", () => {
    expect(getProviderSchema(schema, "azure")).toBe(null);
  });

  it("returns null when no provider is given", () => {
    expect(getProviderSchema(schema, undefined)).toBe(null);
  });
});
