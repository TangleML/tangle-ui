import { isFlagEnabled } from "@/components/shared/Settings/useFlags";
import schema from "@/config/launcherTaskAnnotationSchema.json";
import type { AnnotationConfig, AnnotationOption } from "@/types/annotations";

interface JSONSchemaProperty {
  type: string;
  title?: string;
  description?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  inclusiveMinimum?: number;
  inclusiveMaximum?: number;
  pattern?: string;
  enum?: string[];
  required?: boolean;
  "x-unit"?: string;
  "x-append"?: string;
  "x-enable-quantity"?: boolean;
  "x-enum-labels"?: Record<string, string>;
  "x-enum-deprecated"?: Record<string, boolean>;
  "x-enum-deprecated-messages"?: Record<string, string>;
  "x-enum-successors"?: Record<string, LauncherAcceleratorSuccessor>;
  "x-allow-custom-value"?: boolean;
  "x-hidden"?: boolean;
  "x-type"?: string;
}

interface JSONSchemaObject {
  type: string;
  title?: string;
  properties: Record<string, JSONSchemaProperty>;
  "x-label"?: string;
  "feature-flag-key"?: string;
  "x-deprecated"?: boolean;
  "x-deprecated-message"?: string;
  "x-provider"?: string;
  "x-project"?: string;
  "x-aliases"?: string[];
}

interface CloudProviderSchema extends JSONSchemaProperty {
  annotation: string;
}

export interface LauncherAnnotationSchema {
  $schema?: string;
  type?: string;
  title?: string;
  cloud_provider?: CloudProviderSchema;
  launcher_annotation_schemas?: Record<string, JSONSchemaObject>;
  common_annotations?: JSONSchemaObject;
}

// The launcher config exactly as the backend reads it, so there is one shape and
// one owner. Everything is optional because the endpoint omits fields left at
// their default; an absent `enabled` therefore means enabled, an absent `default`
// means not the default cluster.
interface LauncherClusterSuccessor {
  cluster: string;
  redirect_runs?: boolean;
}

interface LauncherAcceleratorSuccessor extends LauncherClusterSuccessor {
  product: string;
}

interface LauncherAccelerator {
  product: string;
  label?: string | null;
  valid_until?: string | null;
  succeeded_by?: LauncherAcceleratorSuccessor | null;
}

interface LauncherResourceField {
  annotation: string;
  label?: string;
  type?: string;
  description?: string;
  min?: number;
  max?: number;
  unit?: string;
  append?: string;
  enable_quantity?: boolean;
  allow_custom_value?: boolean;
  required?: boolean;
  hidden?: boolean;
  enum?: string[];
  enum_labels?: Record<string, string>;
}

interface LauncherClusterCommon {
  label?: string | null;
  project_id?: string | null;
  valid_until?: string | null;
  succeeded_by?: LauncherClusterSuccessor | null;
  accelerators?: LauncherAccelerator[];
  resource_fields?: LauncherResourceField[];
  enabled?: boolean;
}

interface LauncherGkeCluster extends LauncherClusterCommon {
  location?: string;
  namespace?: string;
  default?: boolean;
}

export interface LauncherNebiusCluster extends LauncherClusterCommon {
  namespace?: string;
}

interface LauncherProvider<Cluster> {
  resource_fields?: LauncherResourceField[];
  clusters?: Record<string, Cluster>;
}

// A platform section either groups clusters or is one target itself, so it may carry
// either shape's fields.
interface LauncherSection
  extends LauncherProvider<LauncherClusterCommon>, LauncherClusterCommon {}

export interface LauncherConfig {
  gke?: LauncherProvider<LauncherGkeCluster>;
  nebius?: LauncherProvider<LauncherNebiusCluster>;
  aliases?: Record<string, string>;
}

export const launcherTaskAnnotationSchema =
  schema satisfies LauncherAnnotationSchema;

export function parseSchemaToAnnotationConfig(
  schema: JSONSchemaObject,
): AnnotationConfig[] {
  const configs: AnnotationConfig[] = [];

  for (const [annotation, property] of Object.entries(schema.properties)) {
    const config: AnnotationConfig = {
      annotation,
      label: property.title || annotation,
    };

    if (property.required) {
      config.required = true;
    }

    // Handle unit
    if (property["x-unit"]) {
      config.unit = property["x-unit"];
    }

    // Handle append suffix
    if (property["x-append"]) {
      config.append = property["x-append"];
    }

    // Handle min/max for numbers
    if (property.exclusiveMinimum !== undefined) {
      config.min = property.exclusiveMinimum + 1;
    }
    if (property.exclusiveMaximum !== undefined) {
      config.max = property.exclusiveMaximum - 1;
    }
    if (property.inclusiveMinimum !== undefined) {
      config.min = property.inclusiveMinimum;
    }
    if (property.inclusiveMaximum !== undefined) {
      config.max = property.inclusiveMaximum;
    }
    if (property.minimum !== undefined) {
      config.min = property.minimum;
    }
    if (property.maximum !== undefined) {
      config.max = property.maximum;
    }

    // Handle type
    // Check for custom x-type first
    const customType = property["x-type"];
    if (customType === "json") {
      config.type = "json";
    } else if (property.type === "number") {
      config.type = "number";
    } else if (property.type === "integer") {
      config.type = "integer";
    } else if (property.type === "boolean") {
      config.type = "boolean";
    } else if (property.type === "string") {
      config.type = "string";
    }

    // Handle enum as options
    if (property.enum) {
      config.options = enumToOptions(property);
    }

    // Handle custom value allowance
    if (property["x-allow-custom-value"]) {
      config.allowCustomValue = true;
    }

    if (property.description) {
      config.description = property.description;
    }

    // Handle quantity enablement
    if (property["x-enable-quantity"]) {
      config.enableQuantity = true;
    }

    if (property["x-hidden"]) {
      config.hidden = true;
    }

    configs.push(config);
  }

  return configs;
}

function parseCloudProviderConfig(
  providerSchema: CloudProviderSchema,
): AnnotationConfig {
  const config: AnnotationConfig = {
    annotation: providerSchema.annotation,
    label: providerSchema.title || "Cloud Provider",
    type: "string",
  };

  if (providerSchema.enum) {
    config.options = enumToOptions(providerSchema);
  }

  return config;
}

export function getCloudProviderConfig(
  schema: LauncherAnnotationSchema,
): AnnotationConfig | null {
  if (!schema.cloud_provider || !schema.launcher_annotation_schemas) {
    return null;
  }

  const config = parseCloudProviderConfig(schema.cloud_provider);

  // If no manual enum is specified, generate from launcher schemas
  if (!config.options) {
    const options: AnnotationOption[] = Object.entries(
      schema.launcher_annotation_schemas,
    )
      .filter(([, launcherSchema]) => {
        const flagKey = launcherSchema["feature-flag-key"];
        return !flagKey || isFlagEnabled(flagKey);
      })
      .map(([key, launcherSchema]) => {
        const name =
          launcherSchema["x-label"] ||
          launcherSchema.title ||
          key.charAt(0).toUpperCase() + key.slice(1);
        const provider = launcherSchema["x-provider"];
        const option: AnnotationOption = {
          value: key,
          name: provider ? `${provider}: ${name}` : name,
        };
        if (launcherSchema["x-project"]) {
          option.caption = `Project: ${launcherSchema["x-project"]}`;
        }
        if (launcherSchema["x-deprecated"]) {
          option.deprecated = true;
          const message = launcherSchema["x-deprecated-message"];
          if (message) {
            option.deprecationMessage = message;
          }
        }
        return option;
      });
    config.options = options;
  }

  return config;
}

export function resolveLauncherKey(
  schema: LauncherAnnotationSchema,
  value: string | undefined,
): string | undefined {
  if (!value || !schema.launcher_annotation_schemas) {
    return value;
  }

  if (schema.launcher_annotation_schemas[value]) {
    return value;
  }

  for (const [key, launcherSchema] of Object.entries(
    schema.launcher_annotation_schemas,
  )) {
    if (launcherSchema["x-aliases"]?.includes(value)) {
      return key;
    }
  }

  return value;
}

export function getProviderSchema(
  schema: LauncherAnnotationSchema,
  provider: string | undefined,
): JSONSchemaObject | null {
  if (!provider || !schema.launcher_annotation_schemas) {
    return null;
  }

  const resolvedKey = resolveLauncherKey(schema, provider);
  return schema.launcher_annotation_schemas[resolvedKey ?? provider] || null;
}

export function getCommonAnnotations(
  schema: LauncherAnnotationSchema,
): AnnotationConfig[] {
  if (!schema.common_annotations) {
    return [];
  }

  return parseSchemaToAnnotationConfig(schema.common_annotations);
}

function enumToOptions(property: JSONSchemaProperty): AnnotationOption[] {
  const labels = property["x-enum-labels"];
  const deprecated = property["x-enum-deprecated"];
  const messages = property["x-enum-deprecated-messages"];

  return (property.enum ?? []).map((value) => {
    const option: AnnotationOption = {
      value,
      name: labels?.[value] || value,
    };
    if (deprecated?.[value]) {
      option.deprecated = true;
      const message = messages?.[value];
      if (message) {
        option.deprecationMessage = message;
      }
    }
    return option;
  });
}

export const ACCELERATORS_ANNOTATION =
  "cloud-pipelines.net/launchers/generic/resources.accelerators";

// Display names a successor pointer resolves against. The config names a successor
// by key alone, so the lookup happens here rather than being resolved server-side.
interface SuccessorLabels {
  cluster: Record<string, string>;
  product: Record<string, string>;
}

function successorLabel(
  successor: LauncherAcceleratorSuccessor,
  labels: SuccessorLabels,
): string {
  const product =
    labels.product[`${successor.cluster}/${successor.product}`] ??
    successor.product;
  return `${product} on ${clusterSuccessorLabel(successor, labels)}`;
}

function clusterSuccessorLabel(
  successor: LauncherClusterSuccessor,
  labels: SuccessorLabels,
): string {
  return labels.cluster[successor.cluster] ?? successor.cluster;
}

// Naming a successor is advice; `redirect_runs` is the assertion that the backend will
// act on it. Only the second makes a move automatic, so only the second may say so.
function successorSentence(
  successor: LauncherClusterSuccessor,
  label: string,
): string {
  return successor.redirect_runs
    ? `Runs are sent to ${label} automatically.`
    : `Use ${label} instead.`;
}

function applyAcceleratorCapabilities(
  property: JSONSchemaProperty,
  accelerators: LauncherAccelerator[],
  now: number,
  successorNames: SuccessorLabels,
): JSONSchemaProperty {
  const seen = new Set<string>();
  const enumValues: string[] = [];
  const labels: Record<string, string> = {};
  const deprecated: Record<string, boolean> = {};
  const messages: Record<string, string> = {};
  const successors: Record<string, LauncherAcceleratorSuccessor> = {};

  for (const accelerator of accelerators) {
    if (seen.has(accelerator.product)) {
      continue;
    }
    seen.add(accelerator.product);
    enumValues.push(accelerator.product);

    if (accelerator.label) {
      labels[accelerator.product] = accelerator.label;
    }

    if (accelerator.succeeded_by) {
      successors[accelerator.product] = accelerator.succeeded_by;
    }

    if (accelerator.valid_until && Date.parse(accelerator.valid_until) <= now) {
      deprecated[accelerator.product] = true;
      const name = accelerator.label || accelerator.product;
      const when = accelerator.valid_until.slice(0, 10);
      messages[accelerator.product] = accelerator.succeeded_by
        ? `${name} is no longer available as of ${when}. ${successorSentence(accelerator.succeeded_by, successorLabel(accelerator.succeeded_by, successorNames))}`
        : `${name} is no longer available as of ${when}`;
    }
  }

  const merged: JSONSchemaProperty = {
    ...property,
    enum: enumValues,
    "x-enum-labels": { ...property["x-enum-labels"], ...labels },
  };

  if (Object.keys(successors).length > 0) {
    merged["x-enum-successors"] = {
      ...property["x-enum-successors"],
      ...successors,
    };
  }

  if (Object.keys(deprecated).length > 0) {
    merged["x-enum-deprecated"] = {
      ...property["x-enum-deprecated"],
      ...deprecated,
    };
    merged["x-enum-deprecated-messages"] = {
      ...property["x-enum-deprecated-messages"],
      ...messages,
    };
  }

  return merged;
}

function fieldCapabilityToProperty(
  field: LauncherResourceField,
): JSONSchemaProperty {
  const property: JSONSchemaProperty = { type: field.type ?? "string" };

  if (field.label !== undefined) property.title = field.label;
  if (field.description !== undefined) property.description = field.description;
  if (field.min !== undefined) property.inclusiveMinimum = field.min;
  if (field.max !== undefined) property.inclusiveMaximum = field.max;
  if (field.unit !== undefined) property["x-unit"] = field.unit;
  if (field.append !== undefined) property["x-append"] = field.append;
  if (field.enable_quantity) property["x-enable-quantity"] = true;
  if (field.allow_custom_value) property["x-allow-custom-value"] = true;
  if (field.required) property.required = true;
  if (field.hidden) property["x-hidden"] = true;
  if (field.enum !== undefined) property.enum = field.enum;
  if (field.enum_labels !== undefined)
    property["x-enum-labels"] = field.enum_labels;

  return property;
}

// Annotation the cluster selection persists to, and the label the picker carries.
// Both are presentation and write-path concerns of this consumer, so they live here
// rather than being read from the config.
export const CLOUD_PROVIDER_ANNOTATION =
  "cloud-pipelines.net/orchestration/cloud_provider";
const CLUSTER_PICKER_LABEL = "Cloud provider";

// Display name for a platform section. A section with no entry here is offered
// under its own config key rather than being left out of the picker.
const PROVIDER_LABELS: Record<string, string> = {
  gke: "GKE",
  nebius: "Nebius",
};

// One dropdown-ready cluster, gathered from whichever provider section declares it.
// The config groups clusters by provider because that is how the backend routes;
// the picker wants one flat list, so the regrouping happens on this side.
// A section that declares no clusters has no cluster for a provider to qualify, so
// it contributes one entry with no `providerLabel`.
interface FlatCluster {
  key: string;
  providerLabel?: string;
  label?: string | null;
  project?: string | null;
  validUntil?: string | null;
  succeededBy?: LauncherClusterSuccessor | null;
  accelerators: LauncherAccelerator[];
  fields: LauncherResourceField[];
  unavailableReason?: string;
}

function resourceFields(
  cluster: LauncherClusterCommon,
  provider: LauncherProvider<unknown> | undefined,
): LauncherResourceField[] {
  return cluster.resource_fields?.length
    ? cluster.resource_fields
    : (provider?.resource_fields ?? []);
}

function flattenClusters(config: LauncherConfig): FlatCluster[] {
  const { aliases: _aliases, ...platforms } = config;
  const sections: [string, LauncherSection | undefined][] =
    Object.entries(platforms);

  const flat: FlatCluster[] = [];
  for (const [sectionKey, section] of sections) {
    if (!section) continue;

    if (!section.clusters) {
      flat.push(flatCluster(sectionKey, section));
      continue;
    }

    const providerLabel = PROVIDER_LABELS[sectionKey] ?? sectionKey;
    for (const [key, cluster] of Object.entries(section.clusters)) {
      flat.push(flatCluster(key, cluster, section, providerLabel));
    }
  }

  return flat;
}

function successorLabels(clusters: FlatCluster[]): SuccessorLabels {
  const labels: SuccessorLabels = { cluster: {}, product: {} };
  for (const cluster of clusters) {
    labels.cluster[cluster.key] = cluster.label || cluster.key;
    for (const accelerator of cluster.accelerators) {
      labels.product[`${cluster.key}/${accelerator.product}`] =
        accelerator.label || accelerator.product;
    }
  }
  return labels;
}

// Build the whole launcher schema from the backend launcher config, which is the
// single source of truth. Every cluster becomes its own dropdown entry keyed by its
// config key, which is also the value persisted as the cluster annotation.
// Visibility is backend presence only — no feature-flag-key is stamped. An
// aliased value still resolves to the cluster through x-aliases, inverted from the
// config's top-level aliases map.
export function buildLauncherSchemaFromCapabilities(
  config: LauncherConfig,
  now: number = Date.now(),
): LauncherAnnotationSchema {
  const launcherSchemas: Record<string, JSONSchemaObject> = {};

  const aliasesByCluster: Record<string, string[]> = {};
  for (const [alias, clusterKey] of Object.entries(config.aliases ?? {})) {
    (aliasesByCluster[clusterKey] ??= []).push(alias);
  }

  const clusters = flattenClusters(config);
  const labels = successorLabels(clusters);

  for (const cluster of clusters) {
    const properties: Record<string, JSONSchemaProperty> = {};
    for (const field of cluster.fields) {
      const property = fieldCapabilityToProperty(field);
      properties[field.annotation] =
        field.annotation === ACCELERATORS_ANNOTATION &&
        cluster.accelerators.length > 0
          ? applyAcceleratorCapabilities(
              property,
              cluster.accelerators,
              now,
              labels,
            )
          : property;
    }

    const object: JSONSchemaObject = {
      type: "object",
      title: cluster.label ?? cluster.key,
      properties,
    };
    if (cluster.providerLabel) {
      object["x-provider"] = cluster.providerLabel;
    }
    if (cluster.project) object["x-project"] = cluster.project;
    const aliases = aliasesByCluster[cluster.key];
    if (aliases && aliases.length > 0) object["x-aliases"] = aliases;

    const name = cluster.label || cluster.key;
    if (cluster.unavailableReason) {
      object["x-deprecated"] = true;
      object["x-deprecated-message"] = cluster.succeededBy
        ? `${cluster.unavailableReason}. ${successorSentence(cluster.succeededBy, clusterSuccessorLabel(cluster.succeededBy, labels))}`
        : cluster.unavailableReason;
    } else if (cluster.validUntil && Date.parse(cluster.validUntil) <= now) {
      object["x-deprecated"] = true;
      const when = cluster.validUntil.slice(0, 10);
      object["x-deprecated-message"] = cluster.succeededBy
        ? `${name} is no longer available as of ${when}. ${successorSentence(cluster.succeededBy, clusterSuccessorLabel(cluster.succeededBy, labels))}`
        : `${name} is no longer available as of ${when}`;
    }

    launcherSchemas[cluster.key] = object;
  }

  const built: LauncherAnnotationSchema = {
    launcher_annotation_schemas: launcherSchemas,
    cloud_provider: {
      annotation: CLOUD_PROVIDER_ANNOTATION,
      type: "string",
      title: CLUSTER_PICKER_LABEL,
    },
  };

  // Common annotations are consumer-specific presentation, so they stay bundled.
  if (launcherTaskAnnotationSchema.common_annotations) {
    built.common_annotations = launcherTaskAnnotationSchema.common_annotations;
  }

  return built;
}

function parseAccelerator(value: string | undefined): {
  product: string;
  quantity: string;
} {
  try {
    const parsed = JSON.parse(value || "{}");
    const product = Object.keys(parsed)[0];
    if (!product) return { product: "", quantity: "" };
    return { product, quantity: String(parsed[product] ?? "") };
  } catch {
    return { product: "", quantity: "" };
  }
}

export interface ClusterSelection {
  cloudProviderValue: string;
  acceleratorAnnotation?: string;
  acceleratorValue?: string;
  clearAccelerator?: boolean;
}

// Forward direction: turn a chosen cluster entry into the values to persist. The
// cluster key is the persisted cloud_provider value. An accelerator is only ever
// carried over, never introduced: one already set is kept at its quantity when the
// target offers the same product, or moved to the product the previous cluster
// declares as its successor there, and otherwise cleared because the target cannot
// run it.
export function resolveClusterSelection(
  schema: LauncherAnnotationSchema,
  clusterKey: string,
  existingAccelerator?: string,
  fromClusterKey?: string,
): ClusterSelection | null {
  const object = schema.launcher_annotation_schemas?.[clusterKey];
  if (!object) return null;

  const cloudProviderValue = clusterKey;
  const { product: existingProduct, quantity: existingQuantity } =
    parseAccelerator(existingAccelerator);
  if (!existingProduct) {
    return { cloudProviderValue };
  }

  const offered = object.properties[ACCELERATORS_ANNOTATION]?.enum ?? [];
  const quantity = existingQuantity || "1";
  const product = offered.includes(existingProduct)
    ? existingProduct
    : acceleratorSuccessorProduct(
        schema,
        fromClusterKey,
        existingProduct,
        clusterKey,
        offered,
      );

  if (!product) {
    return { cloudProviderValue, clearAccelerator: true };
  }

  return {
    cloudProviderValue,
    acceleratorAnnotation: ACCELERATORS_ANNOTATION,
    acceleratorValue: JSON.stringify({ [product]: quantity }),
  };
}

// Annotation keys to clear when switching from one cluster to another: those the
// previous cluster defined that the next one does not. A Nebius-to-Nebius switch
// therefore keeps the shared accelerator key rather than wiping it (which would
// misroute the task to the default Nebius cluster).
export function clusterAnnotationDiff(
  schema: LauncherAnnotationSchema,
  previousKey: string | undefined,
  nextKey: string | undefined,
): string[] {
  const previous = previousKey
    ? schema.launcher_annotation_schemas?.[previousKey]
    : undefined;
  if (!previous) return [];

  const next = nextKey
    ? schema.launcher_annotation_schemas?.[nextKey]
    : undefined;
  const nextKeys = new Set(Object.keys(next?.properties ?? {}));

  return Object.keys(previous.properties).filter((key) => !nextKeys.has(key));
}

// Reverse resolution for reload: find the cluster key a task currently selects. An
// alias maps to its cluster through x-aliases, so a pipeline that named a cluster
// by an alias still resolves to the cluster it runs on.
export function resolveSelectedClusterKey(
  schema: LauncherAnnotationSchema,
  annotations: Record<string, unknown>,
): string | undefined {
  const key = schema.cloud_provider?.annotation;
  const raw = key ? annotations[key] : undefined;
  const persisted = typeof raw === "string" ? raw : undefined;
  return resolveLauncherKey(schema, persisted);
}

// The product the cluster being left declares as this one's successor on the cluster
// being selected, when that cluster still offers it. A successor naming a different
// cluster says nothing about this move, so it is ignored.
function acceleratorSuccessorProduct(
  schema: LauncherAnnotationSchema,
  fromClusterKey: string | undefined,
  product: string,
  toClusterKey: string,
  offered: string[],
): string | undefined {
  if (!fromClusterKey) return undefined;
  const successor =
    schema.launcher_annotation_schemas?.[fromClusterKey]?.properties[
      ACCELERATORS_ANNOTATION
    ]?.["x-enum-successors"]?.[product];
  return successor?.cluster === toClusterKey &&
    offered.includes(successor.product)
    ? successor.product
    : undefined;
}

// How one cluster reads in the picker: the platform qualifies the cluster it runs,
// and an entry with no platform to qualify stands on its own name.
// A section that groups clusters qualifies each with its platform and lends it the
// section's fields; a section that is itself one target brings its own and has no
// platform to qualify it.
function flatCluster(
  key: string,
  cluster: LauncherClusterCommon,
  provider?: LauncherProvider<unknown>,
  providerLabel?: string,
): FlatCluster {
  return {
    key,
    providerLabel,
    label: cluster.label,
    project: cluster.project_id,
    validUntil: cluster.valid_until,
    succeededBy: cluster.succeeded_by,
    accelerators: cluster.accelerators ?? [],
    fields: resourceFields(cluster, provider),
    unavailableReason:
      cluster.enabled === false
        ? `${cluster.label || key} is not enabled for this deployment`
        : undefined,
  };
}

// Which options a dropdown lists. A deprecated one is left out, because nothing
// should hand out a value that is on its way out, except where it is already the
// answer: a task pinned to one still shows it, so the list can say what replaced
// it. The caller disables what it lists as deprecated, so the kept entry reads as
// the current value rather than a choice.
export function listedOptions(
  options: AnnotationOption[],
  currentValue: string | undefined,
): AnnotationOption[] {
  return options.filter(
    (option) => !option.deprecated || option.value === currentValue,
  );
}
