import { beforeEach, describe, expect, it, vi } from "vitest";

import { isFlagEnabled } from "@/components/shared/Settings/useFlags";

import {
  ACCELERATORS_ANNOTATION,
  buildLauncherSchemaFromCapabilities,
  CLUSTER_ANNOTATION,
  clusterAnnotationDiff,
  DAVIES_CLUSTER_KEY,
  getCloudProviderConfig,
  getProviderSchema,
  type LauncherConfig,
  type LauncherNebiusCluster,
  parseSchemaToAnnotationConfig,
  resolveClusterSelection,
  resolveLauncherKey,
  resolveSelectedClusterKey,
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
    "ml-offline-us-ce1-lt3": { "x-aliases": ["google"] },
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
      "x-aliases": ["google"],
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

const CPU_FIELD = {
  annotation: "cloud-pipelines.net/launchers/generic/resources.cpu",
  label: "CPU",
  type: "number",
};

const GPU_FIELD = { annotation: ACCELERATORS_ANNOTATION, label: "GPU" };

const H200 = { product: "NVIDIA-H200", label: "NVIDIA H200" };
const B300 = { product: "NVIDIA-B300-SXM6-PC", label: "NVIDIA B300" };

// The provider sections exactly as the backend serves them: clusters keyed by their
// config key, compute-resource fields declared once for the provider.
const gke = (...keys: string[]): LauncherConfig["gke"] => ({
  resource_fields: [CPU_FIELD],
  clusters: Object.fromEntries(
    keys.map((key) => [
      key,
      { label: key, project_id: "shopify-ml-offline-prod" },
    ]),
  ),
});

const nebius = (
  clusters: Record<string, LauncherNebiusCluster>,
): LauncherConfig["nebius"] => ({
  resource_fields: [GPU_FIELD],
  clusters: Object.fromEntries(
    Object.entries(clusters).map(([key, cluster]) => [
      key,
      { label: `${key} cluster`, ...cluster },
    ]),
  ),
});

describe("buildLauncherSchemaFromCapabilities", () => {
  it("emits one launcher entry per cluster keyed by its config key", () => {
    const built = buildLauncherSchemaFromCapabilities({
      gke: gke("lt3", "eo9"),
      nebius: nebius({ h200: { accelerators: [H200] } }),
    });

    expect(Object.keys(built.launcher_annotation_schemas ?? {})).toEqual([
      "lt3",
      "eo9",
      "h200",
    ]);
    expect(built.cloud_provider).toEqual({
      annotation: CLUSTER_ANNOTATION,
      type: "string",
      title: "Cloud provider",
    });
  });

  it("copies the provider resource fields into properties verbatim and synthesizes the Nebius GPU enum", () => {
    const built = buildLauncherSchemaFromCapabilities({
      gke: gke("eo9"),
      nebius: nebius({ h200: { accelerators: [H200, B300] } }),
    });

    const gkeEntry = built.launcher_annotation_schemas?.eo9;
    expect(Object.keys(gkeEntry?.properties ?? {})).toEqual([
      CPU_FIELD.annotation,
    ]);
    expect(gkeEntry?.properties[ACCELERATORS_ANNOTATION]).toBeUndefined();
    expect(gkeEntry?.["x-provider"]).toBe("Google GKE");
    expect(gkeEntry?.["x-project"]).toBe("shopify-ml-offline-prod");

    const gpu =
      built.launcher_annotation_schemas?.h200.properties[
        ACCELERATORS_ANNOTATION
      ];
    expect(gpu?.enum).toEqual(["NVIDIA-H200", "NVIDIA-B300-SXM6-PC"]);
    expect(gpu?.["x-enum-labels"]).toEqual({
      "NVIDIA-H200": "NVIDIA H200",
      "NVIDIA-B300-SXM6-PC": "NVIDIA B300",
    });
  });

  it("carries a hidden field through so it is still cleared on a cluster switch", () => {
    const built = buildLauncherSchemaFromCapabilities({
      gke: {
        resource_fields: [
          {
            annotation: "google/use_spot_vms",
            label: "Use Spot VMs",
            hidden: true,
          },
        ],
        clusters: { eo9: { label: "eo9" } },
      },
      nebius: nebius({ h200: { accelerators: [H200] } }),
    });

    const property =
      built.launcher_annotation_schemas?.eo9.properties["google/use_spot_vms"];
    expect(property?.["x-hidden"]).toBe(true);
    expect(
      parseSchemaToAnnotationConfig(
        built.launcher_annotation_schemas!.eo9,
      ).find((config) => config.annotation === "google/use_spot_vms")?.hidden,
    ).toBe(true);
    expect(clusterAnnotationDiff(built, "eo9", "h200")).toEqual([
      "google/use_spot_vms",
    ]);
  });

  it("prefers a cluster's own resource fields over the provider block", () => {
    const built = buildLauncherSchemaFromCapabilities({
      gke: {
        resource_fields: [CPU_FIELD],
        clusters: {
          eo9: { label: "eo9", resource_fields: [GPU_FIELD] },
          lt3: { label: "lt3" },
        },
      },
    });

    expect(
      Object.keys(built.launcher_annotation_schemas?.eo9.properties ?? {}),
    ).toEqual([ACCELERATORS_ANNOTATION]);
    expect(
      Object.keys(built.launcher_annotation_schemas?.lt3.properties ?? {}),
    ).toEqual([CPU_FIELD.annotation]);
  });

  it("marks an accelerator past its valid_until as deprecated", () => {
    const built = buildLauncherSchemaFromCapabilities({
      nebius: nebius({
        h200: {
          accelerators: [{ ...H200, valid_until: "2020-01-01T00:00:00Z" }],
        },
      }),
    });

    const gpu =
      built.launcher_annotation_schemas?.h200.properties[
        ACCELERATORS_ANNOTATION
      ];
    expect(gpu?.["x-enum-deprecated"]).toEqual({ "NVIDIA-H200": true });
    expect(gpu?.["x-enum-deprecated-messages"]?.["NVIDIA-H200"]).toBe(
      "NVIDIA H200 is no longer available as of 2020-01-01",
    );
  });

  it("looks a successor's display names up from the config it was served with", () => {
    const successor = { cluster: "b300", product: "NVIDIA-B300-SXM6-PC" };
    const built = buildLauncherSchemaFromCapabilities({
      nebius: nebius({
        h200: {
          accelerators: [
            {
              ...H200,
              valid_until: "2020-01-01T00:00:00Z",
              succeeded_by: successor,
            },
          ],
        },
        b300: { accelerators: [B300] },
      }),
    });

    const gpu =
      built.launcher_annotation_schemas?.h200.properties[
        ACCELERATORS_ANNOTATION
      ];
    expect(gpu?.["x-enum-deprecated-messages"]?.["NVIDIA-H200"]).toBe(
      "NVIDIA H200 is no longer available as of 2020-01-01. Use NVIDIA B300 on b300 cluster instead.",
    );
    expect(gpu?.["x-enum-successors"]?.["NVIDIA-H200"]).toEqual(successor);
  });

  it("says a redirectable accelerator successor is taken automatically", () => {
    const successor = {
      cluster: "b300",
      product: "NVIDIA-B300-SXM6-PC",
      redirect_runs: true,
    };
    const built = buildLauncherSchemaFromCapabilities({
      nebius: nebius({
        h200: {
          accelerators: [
            {
              ...H200,
              valid_until: "2020-01-01T00:00:00Z",
              succeeded_by: successor,
            },
          ],
        },
        b300: { accelerators: [B300] },
      }),
    });

    const gpu =
      built.launcher_annotation_schemas?.h200.properties[
        ACCELERATORS_ANNOTATION
      ];
    expect(gpu?.["x-enum-deprecated-messages"]?.["NVIDIA-H200"]).toBe(
      "NVIDIA H200 is no longer available as of 2020-01-01. Runs are sent to NVIDIA B300 on b300 cluster automatically.",
    );
    expect(gpu?.["x-enum-successors"]?.["NVIDIA-H200"]).toEqual(successor);
  });

  it("marks a cluster past its valid_until as deprecated and points at the successor", () => {
    const built = buildLauncherSchemaFromCapabilities({
      nebius: nebius({
        h200: {
          valid_until: "2020-01-01T00:00:00Z",
          succeeded_by: { cluster: "b300" },
        },
        b300: { accelerators: [B300] },
      }),
    });

    const entry = built.launcher_annotation_schemas?.h200;
    expect(entry?.["x-deprecated"]).toBe(true);
    expect(entry?.["x-deprecated-message"]).toBe(
      "h200 cluster is no longer available as of 2020-01-01. Use b300 cluster instead.",
    );
    expect(entry?.["x-successor"]).toEqual({ cluster: "b300" });
  });

  it("says a redirectable cluster successor is taken automatically", () => {
    const built = buildLauncherSchemaFromCapabilities({
      nebius: nebius({
        h200: {
          valid_until: "2020-01-01T00:00:00Z",
          succeeded_by: { cluster: "b300", redirect_runs: true },
        },
        b300: { accelerators: [B300] },
      }),
    });

    const entry = built.launcher_annotation_schemas?.h200;
    expect(entry?.["x-deprecated"]).toBe(true);
    expect(entry?.["x-deprecated-message"]).toBe(
      "h200 cluster is no longer available as of 2020-01-01. Runs are sent to b300 cluster automatically.",
    );
    expect(entry?.["x-successor"]).toEqual({
      cluster: "b300",
      redirect_runs: true,
    });
  });

  it("names a successor by key when the config carries no label for it", () => {
    const built = buildLauncherSchemaFromCapabilities({
      nebius: {
        clusters: {
          h200: {
            valid_until: "2020-01-01T00:00:00Z",
            succeeded_by: { cluster: "ce7" },
          },
        },
      },
    });

    expect(
      built.launcher_annotation_schemas?.h200["x-deprecated-message"],
    ).toBe("h200 is no longer available as of 2020-01-01. Use ce7 instead.");
  });

  it("inverts aliases into per-cluster x-aliases and stamps no feature flag", () => {
    const built = buildLauncherSchemaFromCapabilities({
      gke: gke("lt3"),
      aliases: { google: "lt3" },
    });

    const lt3 = built.launcher_annotation_schemas?.lt3;
    expect(lt3?.["x-aliases"]).toEqual(["google"]);
    expect(lt3?.["feature-flag-key"]).toBeUndefined();
    expect(lt3?.["x-active"]).toBeUndefined();
  });

  it("falls back to the key as the title and stays selectable with no fields", () => {
    const built = buildLauncherSchemaFromCapabilities({
      nebius: { clusters: { ce7: {} } },
    });

    const entry = built.launcher_annotation_schemas?.ce7;
    expect(entry?.title).toBe("ce7");
    expect(entry?.properties).toEqual({});
    expect(getCloudProviderConfig(built)?.options?.map((o) => o.value)).toEqual(
      ["ce7"],
    );
  });

  it("offers Davies from its singleton section with its own resource fields", () => {
    const built = buildLauncherSchemaFromCapabilities({
      davies: {
        url: "https://davies.example",
        label: "Davies",
        resource_fields: [GPU_FIELD],
      },
    });

    const entry = built.launcher_annotation_schemas?.[DAVIES_CLUSTER_KEY];
    expect(entry?.title).toBe("Davies");
    expect(entry?.["x-provider"]).toBe("Davies");
    expect(Object.keys(entry?.properties ?? {})).toEqual([
      ACCELERATORS_ANNOTATION,
    ]);
    expect(entry?.["x-deprecated"]).toBeUndefined();
  });

  it("shows a disabled Davies as unavailable rather than hiding it", () => {
    const built = buildLauncherSchemaFromCapabilities({
      davies: {
        url: "https://davies.example",
        label: "Davies",
        enabled: false,
      },
    });

    const entry = built.launcher_annotation_schemas?.[DAVIES_CLUSTER_KEY];
    expect(entry?.["x-deprecated"]).toBe(true);
    expect(entry?.["x-deprecated-message"]).toBe(
      "Davies is not enabled for this deployment",
    );

    const option = getCloudProviderConfig(built)?.options?.find(
      (candidate) => candidate.value === DAVIES_CLUSTER_KEY,
    );
    expect(option?.deprecated).toBe(true);
    expect(option?.deprecationMessage).toBe(
      "Davies is not enabled for this deployment",
    );
  });
});

describe("resolveClusterSelection", () => {
  const schema = buildLauncherSchemaFromCapabilities({
    gke: gke("eo9"),
    nebius: nebius({ h200: { accelerators: [H200, B300] } }),
  });

  it("returns null for an unknown cluster", () => {
    expect(resolveClusterSelection(schema, "nope")).toBe(null);
  });

  it("persists only the key for a GKE cluster with no GPUs", () => {
    expect(resolveClusterSelection(schema, "eo9")).toEqual({
      cloudProviderValue: "eo9",
    });
  });

  it("seeds the first product at quantity 1 for a Nebius cluster", () => {
    expect(resolveClusterSelection(schema, "h200")).toEqual({
      cloudProviderValue: "h200",
      acceleratorAnnotation: ACCELERATORS_ANNOTATION,
      acceleratorValue: JSON.stringify({ "NVIDIA-H200": "1" }),
    });
  });

  it("keeps the existing product and quantity when the target still offers it", () => {
    expect(
      resolveClusterSelection(
        schema,
        "h200",
        JSON.stringify({ "NVIDIA-B300-SXM6-PC": "4" }),
      ),
    ).toEqual({
      cloudProviderValue: "h200",
      acceleratorAnnotation: ACCELERATORS_ANNOTATION,
      acceleratorValue: JSON.stringify({ "NVIDIA-B300-SXM6-PC": "4" }),
    });
  });

  it("reseeds when the existing product is not offered by the target", () => {
    const single = buildLauncherSchemaFromCapabilities({
      nebius: nebius({ b300: { accelerators: [B300] } }),
    });

    expect(
      resolveClusterSelection(
        single,
        "b300",
        JSON.stringify({ "NVIDIA-H200": "2" }),
      ),
    ).toEqual({
      cloudProviderValue: "b300",
      acceleratorAnnotation: ACCELERATORS_ANNOTATION,
      acceleratorValue: JSON.stringify({ "NVIDIA-B300-SXM6-PC": "2" }),
    });
  });
});

describe("clusterAnnotationDiff", () => {
  const schema = buildLauncherSchemaFromCapabilities({
    gke: gke("eo9"),
    nebius: nebius({ h200: { accelerators: [H200] } }),
  });

  it("excludes the shared accelerator on a Nebius-to-Nebius switch", () => {
    const twoNebius = buildLauncherSchemaFromCapabilities({
      nebius: nebius({
        h200: { accelerators: [H200] },
        b300: { accelerators: [B300] },
      }),
    });

    expect(clusterAnnotationDiff(twoNebius, "h200", "b300")).toEqual([]);
  });

  it("includes the accelerator when switching from Nebius to GKE", () => {
    expect(clusterAnnotationDiff(schema, "h200", "eo9")).toEqual([
      ACCELERATORS_ANNOTATION,
    ]);
  });

  it("returns nothing when the previous cluster is unknown", () => {
    expect(clusterAnnotationDiff(schema, undefined, "eo9")).toEqual([]);
  });
});

describe("resolveSelectedClusterKey", () => {
  const schema = buildLauncherSchemaFromCapabilities({
    gke: gke("lt3", "eo9"),
    nebius: nebius({ h200: { accelerators: [H200] } }),
    aliases: { google: "lt3", nebius: "h200" },
  });

  it("reads the cluster key from the modern annotation", () => {
    expect(
      resolveSelectedClusterKey(schema, { [CLUSTER_ANNOTATION]: "eo9" }),
    ).toBe("eo9");
  });

  it("falls back to the legacy annotation when the modern one is absent", () => {
    expect(
      resolveSelectedClusterKey(schema, {
        [CLOUD_PROVIDER_ANNOTATION]: "h200",
      }),
    ).toBe("h200");
  });

  it("resolves an alias to its cluster key from either annotation", () => {
    expect(
      resolveSelectedClusterKey(schema, {
        [CLOUD_PROVIDER_ANNOTATION]: "google",
      }),
    ).toBe("lt3");
    expect(
      resolveSelectedClusterKey(schema, { [CLUSTER_ANNOTATION]: "nebius" }),
    ).toBe("h200");
  });

  it("prefers the modern annotation over a stale legacy annotation", () => {
    expect(
      resolveSelectedClusterKey(schema, {
        [CLUSTER_ANNOTATION]: "eo9",
        [CLOUD_PROVIDER_ANNOTATION]: "google",
      }),
    ).toBe("eo9");
  });

  it("returns undefined when no selection is persisted", () => {
    expect(resolveSelectedClusterKey(schema, {})).toBe(undefined);
  });

  it("passes an unknown value through unchanged", () => {
    expect(
      resolveSelectedClusterKey(schema, { [CLUSTER_ANNOTATION]: "azure" }),
    ).toBe("azure");
  });
});
