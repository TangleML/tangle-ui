import type { RemoteToolMap } from "@tangent/remote-subagent";

import type {
  ProjectCardEntry,
  ProjectCardToolDeps,
} from "@/routes/v2/pages/Tangent/services/createProjectCardHandlers";
import { coerceWorkareaTarget } from "@/routes/v2/pages/Tangent/services/resolveWorkareaTarget";
import type { SessionFileRecord } from "@/routes/v2/pages/Tangent/services/sessionFiles";
import { formatWorkareaTarget } from "@/services/projects/resourceTarget";
import { isRecord } from "@/utils/typeGuards";

const ARCHIVABLE_TYPES = new Set(["run", "pipeline", "document"]);

function requireString(args: unknown, key: string): string {
  const value = isRecord(args) ? args[key] : undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`\`${key}\` is required and must be a non-empty string.`);
  }
  return value.trim();
}

function optionalString(args: unknown, key: string): string | undefined {
  const value = isRecord(args) ? args[key] : undefined;
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

/** The card keys what's archived by a target's formatted string. */
function archivableTarget(args: unknown): string {
  const target = coerceWorkareaTarget(requireString(args, "target"));
  if (!ARCHIVABLE_TYPES.has(target.type)) {
    throw new Error(
      "Only a run, pipeline or document can be archived from the project card.",
    );
  }
  return formatWorkareaTarget(target);
}

/** The card's archive and restore buttons are only on its rows, so the agent's are too. */
async function cardEntry(
  args: unknown,
  deps: ProjectCardToolDeps,
): Promise<ProjectCardEntry> {
  const target = archivableTarget(args);
  const { runs, pipelines, documents } = await deps.listEntries();
  const entry = [...runs, ...pipelines, ...documents].find(
    (candidate) => candidate.target === target,
  );
  if (!entry) {
    throw new Error(
      `\`${target}\` isn't on the project card. \`list_project_items\` lists what is.`,
    );
  }
  return entry;
}

function chatOf(args: unknown, deps: ProjectCardToolDeps): string {
  const sessionId =
    optionalString(args, "sessionId") ?? deps.getActiveSessionId();
  if (!sessionId) {
    throw new Error("No chat is open, so there is no chat to act on.");
  }
  return sessionId;
}

/**
 * The card pins and unpins only the files it lists, which come from this
 * project's own chats, so a chat id from another project is refused.
 */
async function listedFile(
  args: unknown,
  deps: ProjectCardToolDeps,
): Promise<SessionFileRecord> {
  const path = requireString(args, "path");
  const sessionId = chatOf(args, deps);
  const file = (await deps.listFiles()).find(
    (candidate) => candidate.sessionId === sessionId && candidate.path === path,
  );
  if (!file) {
    throw new Error(
      `No file \`${path}\` in that chat of this project. \`list_project_files\` lists them.`,
    );
  }
  return file;
}

const TARGET_SCHEMA = {
  type: "object",
  properties: {
    target: {
      type: "string",
      description:
        "The item's `target` as `list_project_items` gives it, e.g. " +
        "`run://id/<runId>` or `document://id/<resourceId>`.",
    },
  },
  required: ["target"],
};

const FILE_PROPERTIES = {
  path: {
    type: "string",
    description:
      "The file's path in its chat's workspace, as `list_project_files` " +
      "gives it, e.g. `artifacts/report.html`.",
  },
  sessionId: {
    type: "string",
    description:
      "The chat the file belongs to, from `list_project_files`. Defaults to " +
      "this chat.",
  },
};

const RUN_ID_SCHEMA = {
  type: "object",
  properties: {
    runId: { type: "string", description: "The pipeline run's id." },
  },
  required: ["runId"],
};

/**
 * What a person can do from the project card and the chat's runs pill,
 * offered to the agent too. Each tool changes the same shared state the
 * buttons do, so people see what the agent did.
 */
export function createProjectCardRemoteTools(
  getDeps: () => ProjectCardToolDeps,
): RemoteToolMap {
  return {
    list_project_items: {
      description:
        "List what the project card shows: the project's latest runs, its " +
        "pipelines and its documents, newest first. Each comes with its " +
        "`target`, its name, when it ran or was added, and whether it's " +
        "archived. Archived items are under the card's 'Show archived'.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const entries = await getDeps().listEntries();
        const rows = (list: ProjectCardEntry[], dateKey: string) =>
          list.map(({ target, name, at, archived }) => ({
            target,
            name,
            [dateKey]: at?.toISOString() ?? null,
            archived,
          }));
        return {
          runs: rows(entries.runs, "ranAt"),
          pipelines: rows(entries.pipelines, "addedAt"),
          documents: rows(entries.documents, "addedAt"),
        };
      },
    },
    archive_project_item: {
      description:
        "Archive a run, pipeline or document, as the archive button on its " +
        "row in the project card does, so the card shows what's still in " +
        "play. Nothing is deleted: it moves under 'Show archived' for " +
        "everyone in the project and can be restored.",
      inputSchema: TARGET_SCHEMA,
      execute: async (args) => {
        const deps = getDeps();
        const { target } = await cardEntry(args, deps);
        await deps.setArchived(target, true);
        return { archived: true, target };
      },
    },
    restore_project_item: {
      description:
        "Restore an archived run, pipeline or document to its section of " +
        "the project card.",
      inputSchema: TARGET_SCHEMA,
      execute: async (args) => {
        const deps = getDeps();
        const { target, archived } = await cardEntry(args, deps);
        if (!archived) throw new Error(`\`${target}\` isn't archived.`);
        await deps.setArchived(target, false);
        return { archived: false, target };
      },
    },
    list_project_files: {
      description:
        "List every file the project's chats made, newest first, as the " +
        "card's 'All files' does. Pinned files are the project's reports. " +
        "Each file has its chat's `sessionId`, and `inThisChat` says " +
        "whether it's in your own workspace.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const deps = getDeps();
        const files = await deps.listFiles();
        const thisChat = deps.getActiveSessionId();
        return {
          files: files.map(({ sessionId, path, title, pinned, addedAt }) => ({
            sessionId,
            path,
            title,
            pinned,
            addedAt: addedAt.toISOString(),
            inThisChat: sessionId === thisChat,
          })),
        };
      },
    },
    pin_project_file: {
      description:
        "Pin a file from any of the project's chats to the project's reports, " +
        "as the card's pin button does. Pin only finished work that's ready " +
        "to share. For a file in your own workspace, `pin_artifact` does the " +
        "same.",
      inputSchema: {
        type: "object",
        properties: {
          ...FILE_PROPERTIES,
          title: {
            type: "string",
            description: "Label shown in the reports. Defaults to the path.",
          },
        },
        required: ["path"],
      },
      execute: async (args) => {
        const deps = getDeps();
        const { sessionId, path } = await listedFile(args, deps);
        await deps.pinFile(
          sessionId,
          path,
          optionalString(args, "title") ?? path,
        );
        return { pinned: true, path };
      },
    },
    unpin_project_file: {
      description:
        "Take a file from any of the project's chats out of the project's " +
        "reports, as the card's unpin button does. The file stays and is " +
        "still listed under 'All files'.",
      inputSchema: {
        type: "object",
        properties: FILE_PROPERTIES,
        required: ["path"],
      },
      execute: async (args) => {
        const deps = getDeps();
        const { sessionId, path } = await listedFile(args, deps);
        await deps.unpinFile(sessionId, path);
        return { pinned: false, path };
      },
    },
    list_chat_runs: {
      description:
        "List the runs in this chat's runs pill, newest first, with whether " +
        "each was dismissed from it. Use `get_run_status` for a run's status.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const deps = getDeps();
        const runs = await deps.listChatRuns(chatOf({}, deps));
        return {
          runs: runs.map(({ id, name, addedAt, dismissed }) => ({
            runId: id,
            name,
            addedAt: addedAt.toISOString(),
            dismissed,
          })),
        };
      },
    },
    dismiss_chat_run: {
      description:
        "Dismiss a run from this chat's runs pill, as its dismiss button " +
        "does, once it no longer needs watching. It stays in the project's " +
        "runs. Returns `{ dismissed: false }` when the run isn't in this chat.",
      inputSchema: RUN_ID_SCHEMA,
      execute: async (args) => {
        const deps = getDeps();
        const runId = requireString(args, "runId");
        return {
          dismissed: await deps.dismissChatRun(chatOf({}, deps), runId),
        };
      },
    },
    add_run_to_project: {
      description:
        "Add an existing pipeline run to the project, as the card's 'Add a " +
        "pipeline run' does. Returns `{ added: false }` when the project " +
        "already holds it.",
      inputSchema: {
        type: "object",
        properties: {
          runId: { type: "string", description: "The pipeline run's id." },
          name: {
            type: "string",
            description: "Name to list it under. Defaults to its pipeline's.",
          },
        },
        required: ["runId"],
      },
      execute: async (args) =>
        getDeps().addRun(
          requireString(args, "runId"),
          optionalString(args, "name"),
        ),
    },
    add_document_to_project: {
      description:
        "Add a document to the project, as the card's 'Add a document' does: " +
        "titled text that belongs to the project rather than to one chat. " +
        "Returns its `target`, which `open_workarea_target` opens.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "The document's title." },
          content: { type: "string", description: "The document's text." },
        },
        required: ["title", "content"],
      },
      execute: async (args) => {
        const content = isRecord(args) ? args.content : undefined;
        if (typeof content !== "string") {
          throw new Error("`content` is required and must be a string.");
        }
        const target = await getDeps().addDocument(
          requireString(args, "title"),
          content,
        );
        return { target };
      },
    },
  };
}
