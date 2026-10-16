# Tangent Local Agent (VS Code)

A VS Code extension that connects your editor to a Tangent Shell in both directions:

- **Prime → your machine.** The extension registers as a remote environment on the Shell's
  `/remote-env` namespace. When Prime calls `spawn_subagent` with `environment: "remote"`, the
  sub-agent runs here as a local `pi --mode rpc` process in your open workspace folder and streams
  its replies back into the session.
- **Your machine → Tangent.** Start a new session or attach to an existing one from VS Code, and
  chat with it in an editor panel, the same chat the Tangent Shell shows.
- **Current Tangle project.** The **Tangle** activity bar container follows one project at a time,
  with **Runs**, **Resources**, and **Sessions** views. New sessions are recorded on the project and
  get this window's local environment and file tools.

This is an MVP: it authenticates as a dev identity (an unsigned JWT for `tangent.userEmail`) and
isn't published to a marketplace.

## Prerequisites

- `pi` on your `PATH` (or set `tangent.piBin`). Local sub-agents use your own pi configuration
  unless you set `tangent.piProxyUrl`.
- A Shell that accepts the extension's dev identity on its `/remote-env` namespace.
- A folder open in VS Code. Sub-agents run there with the pi built-in tools Prime grants (`read`,
  `write`, `edit`, `bash`, `grep`, `find`, `ls`), always including `read`, `ls`, `grep`, and `find`.
  A sub-agent granted none of them gets all seven.

## Run it

The extension is a standalone package, separate from the Tangle UI app: it has its own
`package.json`, lockfile, and `pnpm-workspace.yaml`, and the root project's typecheck and knip skip
it.

```bash
cd vscode-extension
pnpm install
pnpm build
```

Then open `vscode-extension` in VS Code and press F5 (**Run Tangent Local Agent**). To install it
into your everyday editor instead, build a `.vsix` and install it:

```bash
pnpm package
code --install-extension tangent-local-agent-0.0.18.vsix
```

The web app also serves the current build: run `/extension/install.sh` (or `install.ps1`) from the
deployment to download and install the latest `.vsix`, e.g.
`curl -fsSL <app-origin>/extension/install.sh | sh -s -- <app-origin>`.

## Connect

Run **Tangent: Connect Local Agent** (or click the **Tangent** status bar item), then enter the
Shell URL, e.g. `http://localhost:5173`. Pasting a session URL (`…/sessions/<id>`) also attaches to
that session.

The extension reconnects on startup (`tangent.autoConnect`). A link of the form
`vscode://tangent.tangent-local-agent/connect?url=<shell url>` (optionally with `apiUrl`,
`projectId`, and `projectName`) sets the window up for you. When the link points at a Shell or Tangle
API host you are not already connected to, the extension asks you to confirm those hosts before
connecting.

## Commands

| Command                         | What it does                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------- |
| Tangle: Select Project          | Pick the current project. The Runs, Resources, and Sessions views follow it. |
| Tangle: New Session             | Create a session in the current project and open its chat.                   |
| Tangle: Open Project in Tangle  | Open the current project in the Tangle web app.                              |
| Tangle: Set Tangle API URL      | Set the Tangle backend URL and an optional bearer token.                     |
| Tangle: Refresh                 | Reload the Runs, Resources, and Sessions views.                              |
| Tangent: Connect Local Agent    | Set the Shell URL and token, then connect.                                   |
| Tangent: Attach to Session      | Open any Shell session's chat by URL or id, even one outside the project.    |
| Tangent: Disconnect Local Agent | Stop every local sub-agent and disconnect.                                   |
| Tangent: Set Pi Proxy API Key   | Store the key local pi uses with `tangent.piProxyUrl`.                       |

Opening, renaming, and removing a session are on the session's inline button and context menu in
the **Sessions** view.

The status bar shows the connection state and how many sub-agents are running. Its menu can stop
any single sub-agent, and each new sub-agent shows a notification with a **Stop** button.

## Settings

| Setting                    | Default                 | Purpose                                                          |
| -------------------------- | ----------------------- | ---------------------------------------------------------------- |
| `tangent.shellUrl`         | —                       | Shell to connect to.                                             |
| `tangent.autoConnect`      | `true`                  | Reconnect on startup.                                            |
| `tangent.defaultBundleId`  | —                       | Bundle for **New Session**. Empty means pick from a list.        |
| `tangent.userEmail`        | —                       | Identity this window mints scoped tokens as. Empty uses dev.     |
| `tangent.piBin`            | `pi`                    | Path to the pi executable.                                       |
| `tangent.piModel`          | —                       | Model (`provider/id`) for local sub-agents. Empty uses Prime's.  |
| `tangent.piProxyUrl`       | —                       | LLM proxy for local pi. Empty uses your own pi configuration.    |
| `tangent.tangleApiUrl`     | `http://localhost:8000` | Tangle backend for projects, runs, and resources.                |
| `tangent.tangleUiUrl`      | `http://localhost:3000` | Tangle web app used to open projects and runs.                   |
| `tangent.updateBaseUrl`    | —                       | Base URL checked for new `.vsix` builds. Empty uses tangleUiUrl. |
| `tangent.autoCheckUpdates` | `true`                  | Check for a newer build on startup and offer to update.          |

With `tangent.piProxyUrl` set, local pi loads the bundled proxy-provider extension and reads the
key from **Set Pi Proxy API Key**, falling back to `PI_PROXY_API_KEY` in VS Code's environment.

## Current project

The **Tangle** activity bar container follows one project, picked with **Select Project** (title bar
of any of its views). The choice is remembered per workspace, and each view shows the project name.
Until a project is picked, the views offer **Select Project** and **Set Tangle API URL** instead.
Projects, runs, and resources come from the Tangle backend REST API (`tangent.tangleApiUrl`).

- **Runs** lists the project's runs (`GET /api/projects/{id}/runs`), newest first, with the overall
  status computed from task counts the same way the web app does. While the view is visible and a
  run is still active (running, pending, queued, …), active runs refresh every 10 seconds. Long
  lists page in with **Load more runs…**. Click a run to open it in the Tangle web app
  (`tangent.tangleUiUrl`).
- **Resources** lists the project's pipelines and documents, most recently updated first. Click one
  to open it in the web app: a pipeline opens in the editor, a run reference opens the run, anything
  else opens the project page.
- **Sessions** lists the project's agentic sessions: its `agent_session` resources, each pointing at
  a Tangent Shell session. **New Session** (the `+` in the title bar) creates a Shell session from an
  agent bundle, records it on the project, and opens its chat. **Remove Session from Project**
  deletes only the project's resource; the session stays on the Shell. The session open in this
  window's chat is marked **local env**; the window's local environment serves every session.

A run belongs to a project through its `tangleml.com/project/id/<projectId>` annotation, set when the
run is submitted, so runs submitted from the web app with a project, or from a client that sets the
annotation, show up here.

## Session chat

Opening a session attaches this window to it (see [How routing works](#how-routing-works)), so
Prime's remote sub-agents and read-only file tools run here, and opens the session's chat in an
editor panel. The panel renders the Shell's own embeddable chat (`<Chat>` from
`@tangent/embed-react`), so messages, streaming, attachments, and model choice behave as they do in
the Shell. The panel follows the VS Code light or dark theme, and artifact links open in your
browser.

The chat runtime, its API calls, and its socket all come from the Shell, through a loopback proxy
the extension starts on `127.0.0.1`. The Shell answers CORS only for an exact list of origins
(`EMBED_ALLOWED_ORIGINS`), and a webview's origin is a fresh `vscode-webview://<id>` for every panel,
so it can't be listed there. The proxy accepts only webview origins and forwards to the Shell
without an `Origin` header.

Known limits:

- The panel connects without a user token, the same way the web app embed does today.
- Bundle UI widgets in messages show "This component could not be displayed". The Shell's runtime
  starts their Web Worker from its own origin, and browsers refuse cross-origin workers, so this
  needs a fix in the Shell (for example, starting the worker from a `blob:` URL).
- Against a Shell running under Vite dev, the page installs no-op React Fast Refresh hooks before
  loading the runtime, because Vite's dev modules throw without them.

## How routing works

Each VS Code window connects as its own environment, `vscode-<id>`, and stays connected under that
id for every session. The Shell treats it as a generic dev host eligible for all of the project's
sessions, so one window serves them all — opening or switching sessions no longer changes the id or
reconnects the bridge, and running sub-agents are never interrupted. When several windows connect,
the most recently connected one serves every session; pinning a specific window to a specific
session is not supported.

Server-only tools in Prime's allowlist (`message_prime`, `read_room`, …) are dropped, because local
pi doesn't have them. A local sub-agent is never started without file tools: it always gets read
access to the workspace, and the full built-in set when the allowlist names no built-in tools. Its
finished replies still reach Prime through the session.

## Read-only file tools

For light lookups, Prime doesn't need a local sub-agent. The extension registers read-only tools that
Prime calls directly through `list_remote_tools` / `call_remote_tool`. No local pi process starts and
no local tokens are spent:

| Tool          | What it returns                                                        |
| ------------- | ---------------------------------------------------------------------- |
| `read_file`   | A text file's contents, truncated past `maxBytes` (256 KB by default). |
| `list_dir`    | A directory's entries. Directory names end with `/`.                   |
| `find_files`  | Paths matching a glob such as `*.ts` or `src/**/*.test.ts`.            |
| `search_text` | `path:line: text` for each line matching a string or regex.            |

Paths are relative to the first workspace folder. Anything outside it is refused, including symlinks
that point outside. Binary files are skipped, and so are `.git`, `node_modules`, and build output
folders.

The window acts as a generic dev host, so its tool calls reach any of the project's sessions. If a
browser embed with a session-scoped token is connected to a session, the embed handles that
session's tool calls instead of VS Code.

## Develop

The host logic (pi adapter, file tools, URL parsing) is imported from `@tangent/local-agent-host`,
not vendored here. It, `@tangent/shared`, `@tangent/remote-subagent`, and `@tangent/embed-react`
come from the `TangleML/tangent-shell` GitHub repo, pinned to a commit.

esbuild produces two bundles: `dist/extension.cjs` for the extension host and `dist/chat.js`, the
React page inside the chat panel (`src/webview/chat.tsx`, typechecked with
`tsconfig.webview.json`).

```bash
pnpm test       # resource kinds, run status, REST client, update manifest, chat config/html, embed proxy
pnpm typecheck
pnpm lint
pnpm watch      # rebuild on change while running under F5
```

Not in this MVP: user-scoped login instead of the dev token, editor tools for Prime (diagnostics,
apply edit), `tangle-deploy` integration (submit, validate, logs), and marketplace publishing.
