# tangent-tui

A terminal-only client for Tangent Projects. Connect to a Tangle instance, open
(or create) a project, and hold an interactive, tabbed conversation with Prime
right in the terminal. Opening a project also starts a local agent host — the
same one the VS Code extension and `tangent-local-agent` run — so Prime can
spawn local `pi` sub-agents and read files in your working directory.

This is the headless, TUI counterpart to the "Tangent Local Agent" editor
extension and the headless `tangent-local-agent` CLI.

## Screens

1. **Connect** — pick a Tangle instance (e.g. `oasis-staging`, `oasis`) or enter
   a custom URL. The choice is saved under `~/.config/tangent-tui/config.json`
   and reused on the next launch. Okta SSO runs once in your browser and the
   cookie is cached; `--reset` (or the `/reset` command) forgets both.
2. **Project** — open an existing project or create a new one. Opening a project
   resolves its workspace's Tangent Shell URL, starts the local agent host, and
   lists the project's sessions.
3. **Chat** — an interactive conversation with Prime. Markdown is rendered for
   the terminal. Tabs switch between the Prime thread and any sub-agents
   (`Tab` / `←` `→`). Meta actions live behind `/` commands.

## Authentication — no token needed

Like `tangent-local-agent`, the client self-mints the short-lived remote-env
token and authenticates REST and the chat socket with an Okta SSO cookie. On the
first protected request it runs the Okta login once (opening a browser and
listening on `localhost:3001`) and caches the cookie.

The deployment's Okta config must be present at runtime via `OKTASSO_*` and
`AUTH_JWT_TOKEN_COOKIE_NAME` — either in your environment or a `.env` in the
current directory. Without it (local dev), requests go out unauthenticated.

## Usage

```bash
# from source (dev)
pnpm start

# or the built bundle
node dist/tangent-tui.mjs
```

### Options

| Flag           | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `--reset`      | Forget the saved instance and SSO sign-in, then reconnect. |
| `-h`, `--help` | Show help.                                                 |

### Slash commands

Typed into the composer on the chat screen:

| Command      | Description                                       |
| ------------ | ------------------------------------------------- |
| `/help`      | List the available commands.                      |
| `/resources` | List the project's catalogued resources.          |
| `/agents`    | List the session's sub-agents and the local host. |
| `/sessions`  | List this project's sessions.                     |
| `/new`       | Start or switch to another session.               |
| `/web`       | Open this project and session in the browser.     |
| `/reset`     | Forget the saved connection, then reconnect.      |

The registry lives in [src/commands/builtins.ts](src/commands/builtins.ts);
adding a command is appending one `SlashCommand` entry.

## Scripts

- `pnpm start` — run from source with `tsx`.
- `pnpm build` — bundle to `dist/tangent-tui.mjs`.
- `pnpm test` — run the unit tests.
- `pnpm typecheck` — type-check.
- `pnpm lint` — lint.
- `pnpm format` — format with Prettier.
