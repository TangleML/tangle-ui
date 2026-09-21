export type WorkareaViewKindName = "artifact" | "pipeline" | "run";

export type IdentityKey = "id" | "name";

export type WorkareaIdentity = `${IdentityKey}/${string}`;

/**
 * A workarea target: its `type` is both the view kind and the scheme, and its
 * `identity` is sub-key prefixed (`id/<value>` or `name/<value>`). The pair is
 * two-way convertible with its `type://identity` string form.
 *
 * Only a pipeline can be addressed by `name/`; a run and an artifact are always
 * `id/`, so the union rejects `run://name/…` and `artifact://name/…` at compile
 * time as well as in `parseWorkareaTarget`.
 *
 * This lives beside the projects service rather than with the Tangent workarea
 * that dispatches on it, because a project's resource rows record these strings
 * and the project page has to read them too.
 */
export type WorkareaTarget = ArtifactTarget | PipelineTarget | RunTarget;

export interface ArtifactTarget {
  type: "artifact";
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
  "pipeline",
  "run",
];

const IDENTITY_KEYS_BY_TYPE: Record<
  WorkareaViewKindName,
  readonly IdentityKey[]
> = {
  artifact: ["id"],
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

function isCanonicalTarget(raw: string): boolean {
  const separatorIndex = raw.indexOf(TARGET_SEPARATOR);
  if (separatorIndex === -1) return false;
  const type = raw.slice(0, separatorIndex);
  const identity = raw.slice(separatorIndex + TARGET_SEPARATOR.length);
  return isWorkareaViewKindName(type) && isWorkareaIdentity(identity);
}

export function isWorkareaTargetString(
  raw: string,
): raw is WorkareaTargetString {
  return isCanonicalTarget(raw);
}

export function sameTarget(a: WorkareaTarget, b: WorkareaTarget): boolean {
  return a.type === b.type && a.identity === b.identity;
}
