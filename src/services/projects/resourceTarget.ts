export type WorkareaViewKindName = "artifact" | "document" | "pipeline" | "run";

type IdentityKey = "id" | "name";

export type WorkareaIdentity = `${IdentityKey}/${string}`;

/**
 * Two-way convertible with its `type://identity` string form. The union is
 * spelled out per kind so that `run://name/…` and its like are rejected at
 * compile time, not only by `parseWorkareaTarget`.
 *
 * It lives beside the projects service rather than with the Tangent workarea
 * that dispatches on it, because resource rows record these strings and the
 * project page has to read them too.
 */
export type WorkareaTarget =
  ArtifactTarget | DocumentTarget | PipelineTarget | RunTarget;

export interface ArtifactTarget {
  type: "artifact";
  identity: `id/${string}`;
}

/** A document is the resource row, so nothing inside it exists to address. */
export interface DocumentTarget {
  type: "document";
  identity: `id/${string}`;
}

export interface PipelineTarget {
  type: "pipeline";
  identity: WorkareaIdentity;
}

export interface RunTarget {
  type: "run";
  identity: `id/${string}`;
}

export type WorkareaTargetString =
  `${WorkareaViewKindName}://${WorkareaIdentity}`;

const WORKAREA_VIEW_KIND_NAMES: readonly WorkareaViewKindName[] = [
  "artifact",
  "document",
  "pipeline",
  "run",
];

const IDENTITY_KEYS_BY_TYPE: Record<
  WorkareaViewKindName,
  readonly IdentityKey[]
> = {
  artifact: ["id"],
  document: ["id"],
  pipeline: ["id", "name"],
  run: ["id"],
};

const TARGET_SEPARATOR = "://";

export interface ParsedIdentity {
  key: IdentityKey;
  value: string;
}

export function idIdentity(value: string): `id/${string}` {
  return `id/${value}`;
}

export function nameIdentity(value: string): `name/${string}` {
  return `name/${value}`;
}

export function formatWorkareaTarget(
  target: WorkareaTarget,
): WorkareaTargetString {
  return `${target.type}${TARGET_SEPARATOR}${target.identity}`;
}

function isWorkareaViewKindName(value: string): value is WorkareaViewKindName {
  return WORKAREA_VIEW_KIND_NAMES.some((name) => name === value);
}

function isIdentityKey(value: string): value is IdentityKey {
  return value === "id" || value === "name";
}

function isWorkareaIdentity(value: string): value is WorkareaIdentity {
  return /^(id|name)\//.test(value);
}

function splitIdentity(identity: string): ParsedIdentity {
  const slashIndex = identity.indexOf("/");
  const key = identity.slice(0, slashIndex);
  if (slashIndex === -1 || !isIdentityKey(key)) {
    throw new Error(`Malformed workarea target identity: ${identity}`);
  }
  return { key, value: identity.slice(slashIndex + 1) };
}

export function parseIdentity(identity: WorkareaIdentity): ParsedIdentity {
  return splitIdentity(identity);
}

function buildTarget(
  type: WorkareaViewKindName,
  key: IdentityKey,
  value: string,
): WorkareaTarget {
  if (type === "pipeline" && key === "name") {
    return { type, identity: nameIdentity(value) };
  }
  return { type, identity: idIdentity(value) };
}

export function parseWorkareaTarget(raw: string): WorkareaTarget {
  const separatorIndex = raw.indexOf(TARGET_SEPARATOR);
  if (separatorIndex === -1) {
    throw new Error(`Malformed workarea target: ${raw}`);
  }
  const type = raw.slice(0, separatorIndex);
  const identity = raw.slice(separatorIndex + TARGET_SEPARATOR.length);
  if (!isWorkareaViewKindName(type)) {
    throw new Error(`Unsupported workarea target type: ${type}`);
  }
  const { key, value } = splitIdentity(identity);
  if (!IDENTITY_KEYS_BY_TYPE[type].includes(key)) {
    throw new Error(`Unsupported ${type} target identity: ${identity}`);
  }
  return buildTarget(type, key, value);
}

/**
 * Checks the identity key against the kind, not just the shape, so that this
 * passing guarantees `parseWorkareaTarget` will succeed. A shape-only guard let
 * `run://name/x` through and then threw on parse.
 */
export function isWorkareaTargetString(
  raw: string,
): raw is WorkareaTargetString {
  const separatorIndex = raw.indexOf(TARGET_SEPARATOR);
  if (separatorIndex === -1) return false;

  const type = raw.slice(0, separatorIndex);
  const identity = raw.slice(separatorIndex + TARGET_SEPARATOR.length);
  if (!isWorkareaViewKindName(type) || !isWorkareaIdentity(identity)) {
    return false;
  }

  const slashIndex = identity.indexOf("/");
  const key = identity.slice(0, slashIndex);
  return isIdentityKey(key) && IDENTITY_KEYS_BY_TYPE[type].includes(key);
}

export function sameTarget(a: WorkareaTarget, b: WorkareaTarget): boolean {
  return a.type === b.type && a.identity === b.identity;
}
