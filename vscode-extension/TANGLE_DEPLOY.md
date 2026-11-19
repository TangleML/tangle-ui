# Tangle Deploy commands

The extension wraps the [`tangle-deploy`](https://github.com/Shopify/discovery/blob/main/oasis/tangle-deploy/README.md)
CLI so you can submit, validate, publish, and manage Tangle pipelines and components without leaving
VS Code. The extension is a thin shell: it discovers the binary, points it at the right deployment,
runs it, and shows the output. All the logic lives in the CLI.

## Prerequisite: install the CLI

These commands do nothing until `tangle-deploy` is on your machine. Install it with `uv`:

```bash
uv tool install tangle-deploy \
  --index https://pkgs.shopify.io/basic/data/python/simple \
  --index-strategy first-index
```

If it is not on your `PATH`, or you want a specific build, set the path:

- **Setting**: `tangent.tangleDeployBin` (default `tangle-deploy`).

The extension probes the binary on startup (and whenever that setting changes). When it is found, the
context-menu and tree actions below light up. When it is not, running any Tangle Deploy command from
the Command Palette prompts you to install it or set the path.

> **"I don't see any new options."** The Command Palette always lists the `Tangle Deploy:` commands.
> The right-click and tree actions only appear once the CLI is detected — install it (or set
> `tangent.tangleDeployBin`) and they show up.

## Which deployment commands target

The CLI selects its deployment from the `TANGLE_API_BASE_URL` environment variable. The extension sets
it from your existing **`tangent.tangleApiUrl`** setting, so CLI commands and the Runs/Resources views
always talk to the same backend. It also tags runs with `TANGLE_DEPLOY_SOURCE=tangent` for attribution.

Authentication is left to the CLI itself (Minerva locally, or a `TANGLE_AUTH` you already export) — the
extension does not inject credentials.

## Where the commands live

- **Command Palette** (`Cmd/Ctrl+Shift+P`) — everything, under the **`Tangle Deploy:`** category.
- **Editor / Explorer right-click → `Tangle Deploy`** — file actions, filtered by filename (see
  below). Runs on the right-clicked file, or the active editor.
- **Runs view** — right-click a run for run-scoped actions; the title bar has a **Search Runs** button.
- **Saved Pipelines view** — a dedicated panel in the Tangle sidebar (see below).

### Which files show which actions

The right-click `Tangle Deploy` submenu filters its entries by filename, since a static menu cannot
read a file's contents:

- **`*.pipeline.yaml`** → pipeline actions: Submit, Validate, Open in Tangle Editor, Diagram, Save
  Definition, Hydrate, Dehydrate, Auto-Layout, Decompile.
- **`*.yaml`** (that is _not_ `*.pipeline.yaml`) → component actions: Publish, Bump Version.
- **`*.py`** → Submit, Generate Component, Ship from Python, Compile, Convert Airflow DAG.
- **`Dockerfile`** → Generate Component from Dockerfile.

Name pipeline files `<name>.pipeline.yaml` to get the pipeline actions. Every command is also in the
Command Palette regardless of the active file.

## The Saved Pipelines panel

The **Saved Pipelines** view in the Tangle sidebar is a dedicated home for saved-pipeline, schedule,
and subscription management. It groups the actions into **Saved pipelines**, **Scheduling**, and
**Subscriptions**; clicking an entry runs the matching CLI command in the terminal. (The CLI's `list`
commands have no machine-readable output, so this panel lists actions rather than live data.) When the
CLI is not installed, the panel offers an install link instead.

## How output is shown

- **Long-running / streaming** commands (submit, logs, publish, deploy, schedule, …) run in a reused
  integrated terminal named **Tangle Deploy**, so you see the CLI's own progress and run links.
- **Data** commands (diagram, generate-schema) are captured and opened in a new editor tab.
- **Commands that need flags the extension can't prompt for** (e.g. `component generate from-dbt`,
  `pipeline schedule`, `quota-group`, `secrets create`) are **typed into the terminal but not run** —
  finish the line with your options and press Enter.

## Command reference

### Pipeline run loop

| Command                        | CLI                                          | Notes                                                             |
| ------------------------------ | -------------------------------------------- | ----------------------------------------------------------------- |
| Submit Pipeline                | `pipeline-run submit` / `submit-from-python` | Active/selected `.yaml` or `.py`; prompts for optional JSON args. |
| Validate Pipeline (Dry Run)    | `pipeline-run validate`                      | `.yaml`.                                                          |
| Open Pipeline in Tangle Editor | `pipeline view`                              | Opens the YAML in the web editor.                                 |
| Generate Pipeline Diagram      | `pipeline-run diagram`                       | Opens the Mermaid output in a new tab.                            |
| Search Runs                    | `pipeline-run search --created-by me`        | Runs view title button.                                           |
| Show Run Details               | `pipeline-run details`                       | Runs view right-click.                                            |
| Fetch Run Logs                 | `pipeline-run logs`                          | Runs view right-click (uses the run's root execution).            |
| Cancel Run                     | `pipeline-run cancel`                        | Runs view right-click.                                            |
| Export Run as YAML             | `pipeline-run export`                        | Runs view right-click; asks where to save.                        |

### Components

| Command                            | CLI                                                     |
| ---------------------------------- | ------------------------------------------------------- |
| Publish Component                  | `component publish` (prompts for an optional `--image`) |
| Publish Components from Config     | `component publish-all --config <file>`                 |
| Generate Component from Python     | `component generate from-python`                        |
| Generate Component from dbt        | `component generate from-dbt` (compose)                 |
| Generate Component from Dockerfile | `component generate from-docker` (compose)              |
| Inspect Component                  | `component inspect <name/digest>`                       |
| Search Components                  | `component search <query>`                              |
| Bump Component Version             | `component bump-version`                                |
| Deprecate Component                | `component deprecate <digest>`                          |

### Saved pipelines & scheduling

| Command                     | CLI                                                           |
| --------------------------- | ------------------------------------------------------------- |
| Save Pipeline Definition    | `saved-pipeline deploy`                                       |
| Ship Pipeline from Python   | `saved-pipeline ship from-python`                             |
| Sync Pipelines from Python  | `saved-pipeline sync from-python` (compose)                   |
| List Saved Pipelines        | `saved-pipeline list`                                         |
| Read / Run Saved Pipeline   | `saved-pipeline read` / `run`                                 |
| Configure Saved Pipeline    | `saved-pipeline configure` (compose)                          |
| Delete Saved Pipeline       | `saved-pipeline delete` (confirms first)                      |
| List / Manage Schedules     | `saved-pipeline schedule list` / `schedule` (compose)         |
| List / Manage Subscriptions | `saved-pipeline subscription list` / `subscription` (compose) |

### Local YAML transforms

| Command                      | CLI                                         |
| ---------------------------- | ------------------------------------------- |
| Hydrate / Dehydrate Pipeline | `pipeline hydrate` / `dehydrate`            |
| Auto-Layout Pipeline         | `pipeline auto-layout`                      |
| Compile Pipeline from Python | `pipeline compile from-python`              |
| Decompile Pipeline to Python | `pipeline decompile`                        |
| Generate Pipeline Schema     | `pipeline generate-schema` (opens in a tab) |
| Convert Airflow DAG          | `pipeline convert from-airflow` (compose)   |

### Ops & admin

| Command                       | CLI                                                                       |
| ----------------------------- | ------------------------------------------------------------------------- |
| Check Auth (whoami)           | `auth whoami`                                                             |
| List / Create / Delete Secret | `secrets list` / `create` (compose) / `delete`                            |
| List / Set Run Annotation     | `pipeline-run annotations list` / `set` (compose) — Runs view right-click |
| Get / Download Run Artifacts  | `artifacts get` / `download` — Runs view right-click                      |
| List / Manage Quota Group     | `quota-group list` / `quota-group` (compose)                              |
| Browse Docs / Quickstart      | `docs` / `quickstart`                                                     |

## Run status

When the CLI is installed, the Runs view uses `pipeline-run graph-state` for per-task status, so the
extension does not duplicate the backend's status endpoint. Without the CLI it falls back to the REST
API, so the view keeps working either way.
