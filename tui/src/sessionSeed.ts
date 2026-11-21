import * as yaml from "js-yaml";

export type HostResourceInput =
  | { kind: "memory"; scope?: "session" | "global"; content: string }
  | {
      kind: "file";
      path: string;
      content: string;
      encoding?: "utf8" | "base64";
      name?: string;
    }
  | { kind: "mount"; folderId: string; mountName?: string };

export type MemoryBinding =
  | { kind: "simple-md"; root?: string }
  | { kind: "pi-memory"; root?: string }
  | { kind: "composite"; children: MemoryBinding[] };

const PROJECT_ID_ANNOTATION_PREFIX = "tangleml.com/project/id/";
const ROOT_CONFIG_FILENAME = "tangle-deploy-root-config.yaml";
const PROJECT_MOUNT_NAME = "project";
const PROJECT_NOTES_ROOT = `${PROJECT_MOUNT_NAME}/NOTES`;
const PROJECT_PI_MEMORY_ROOT = `${PROJECT_MOUNT_NAME}/pi-memory`;

export function projectRunAnnotationKey(projectId: string): string {
  return `${PROJECT_ID_ANNOTATION_PREFIX}${projectId}`;
}

interface RootConfigSeed {
  resource: Extract<HostResourceInput, { kind: "file" }>;
  env: Record<string, string>;
}

function rootConfigContent(projectId: string): string {
  const annotations = { [projectRunAnnotationKey(projectId)]: "true" };
  return yaml.dump(
    {
      commands: {
        "tangle-deploy pipeline-run submit": { annotations },
        "tangle-deploy pipeline-run submit-from-python": { annotations },
      },
    },
    { noRefs: true },
  );
}

/**
 * The file and the env that points at it: `tangle-deploy` stamps these
 * annotations on every submit it runs under the session, so an agent that
 * submits from its own sandbox attributes the run to the project unprompted.
 */
export function rootConfigSeed(projectId: string): RootConfigSeed {
  return {
    resource: {
      kind: "file",
      path: ROOT_CONFIG_FILENAME,
      content: rootConfigContent(projectId),
    },
    env: { TANGLE_ROOT_CONFIG: `{{uploadsPath}}/${ROOT_CONFIG_FILENAME}` },
  };
}

interface ProjectSharedMemorySeed {
  resource: Extract<HostResourceInput, { kind: "mount" }>;
  memory: MemoryBinding;
}

/**
 * The mount and the binding together: the binding's roots resolve through the
 * mount's symlink, and the mount without the binding leaves memory private.
 */
export function projectSharedMemorySeed(
  folderId: string,
): ProjectSharedMemorySeed {
  return {
    resource: { kind: "mount", folderId, mountName: PROJECT_MOUNT_NAME },
    memory: {
      kind: "composite",
      children: [
        { kind: "simple-md", root: PROJECT_NOTES_ROOT },
        { kind: "pi-memory", root: PROJECT_PI_MEMORY_ROOT },
      ],
    },
  };
}

const NAMING_BRIEF = [
  "Naming this work:",
  "- Call name_session during your first turn, as soon as you have read the",
  "  first message. A title of a few words is enough.",
  "- If rename_project reports the project's name is still provisional, give it",
  "  a title too. It refuses when someone has named the project deliberately.",
  "- Titles describe the work, not the request: 'Churn model training', not",
  "  'User wants a churn model'. Do not announce that you have named anything.",
].join("\n");

const runAttributionBrief = (projectId: string) =>
  [
    "Attributing runs to this project:",
    `- This project's id is ${projectId}, and membership is the annotation`,
    `  \`${projectRunAnnotationKey(projectId)}: "true"\` — the id is in the key`,
    '  and the value is always the string "true".',
    "- `tangle-deploy pipeline-run submit` and `submit-from-python` already carry",
    "  this annotation: the session sets TANGLE_ROOT_CONFIG so every submit is",
    "  attributed for you. Do not pass `-a`/`--annotations` to those commands.",
    "- A run you submit any other way must carry the annotation yourself.",
    "- Name one project per run. A submission naming two is rejected.",
  ].join("\n");

const SHARED_FOLDER_BRIEF = [
  "Sharing work across this project's sessions:",
  `- \`${PROJECT_MOUNT_NAME}/\` is the project's shared folder. Every session in`,
  "  this project mounts the same folder, and writes show up in the others",
  "  immediately. Put work later sessions should build on there, not in",
  "  `uploads/`, which is private to this session.",
  "- Your memory_* tools write a store inside that folder, so other sessions in",
  "  this project read what you remember.",
  `- \`${PROJECT_NOTES_ROOT}/MEMORY.md\` is the project's human-readable note.`,
  "- Never write secrets, tokens or credentials into the shared folder.",
].join("\n");

interface SessionMemorySeedOptions {
  hasSharedFolder?: boolean;
}

export function sessionMemorySeed(
  projectId: string,
  projectInstructions?: string | null,
  { hasSharedFolder = false }: SessionMemorySeedOptions = {},
): string {
  const instructions = projectInstructions?.trim();
  const briefs = [
    NAMING_BRIEF,
    runAttributionBrief(projectId),
    ...(hasSharedFolder ? [SHARED_FOLDER_BRIEF] : []),
  ].join("\n\n");
  return instructions ? `${instructions}\n\n${briefs}` : briefs;
}
