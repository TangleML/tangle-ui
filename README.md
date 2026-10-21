# Tangle app (Frontend)

Tangle is a web app that allows the users to build and run Machine Learning pipelines using drag and drop without having to set up development environment.

[![image](https://github.com/user-attachments/assets/0ce7ccc0-dad7-4f6a-8677-f2adcd83f558)](https://tangleml-tangle.hf.space/#/quick-start)

This is the frontend repo. It contains the entire user interface portion of the app. It is built primarily on Typescript + React + Tailwind CSS, and powered by NodeJS + Vite.

> Go to the [backend repo](https://github.com/TangleML/tangle).

## Demo

[Demo](<[https://cloud-pipelines.net/pipeline-studio-app](https://tangleml-tangle.hf.space/#/quick-start)>)

The experimental new version of the Tangle app is now available at <https://tangleml-tangle.hf.space/#/quick-start> . No registration is required to experiment with building pipelines. To install your own app instance, [duplicate](https://huggingface.co/spaces/TangleML/tangle?duplicate=true) the HuggingFace space or follow the [backend installation instructions](https://github.com/Cloud-Pipelines/backend?tab=readme-ov-file#installation).

Please check it out and report any bugs you find using [GitHub Issues](https://github.com/TangleML/tangle/issues).

The app is under active development and supported by its maintainers.

## Installation

**tangle-ui** can be operated and developed independently of the backend.

### Standalone Web App - Instructions

1. Install [Node](https://nodejs.org/) and [pnpm](https://pnpm.io/installation)
2. Fork the `tangle-ui` repo - we recommend colocating the repo with the backend
3. Navigate to the forked repo and install dependencies with `pnpm install`
4. You are now ready to go! Run the app with `pnpm start` 🚀

You can now run tangle-ui as a standalone web app! Pipelines and data will be stored in browser storage. If you want to make use of backend features, such as executing runs you will need to connect to a backend.

### Integrated Web App - Instructions

1. Complete the steps above
2. Complete the installation steps for the backend as specified in the [backend repo](https://github.com/TangleML/tangle)
3. Create a `.env` file at the root of `tangle-ui`
4. Add an env variable `VITE_BACKEND_API_URL` with the url where your backend is hosted (most likely `http://127.0.0.1:8000`)
5. Run the backend & restart the frontend app

<!-- todo: CORS -->

You should now be running Tangle in its entirety and can enjoy its full suite of features!

If you find you are blocked by CORS, you will, for now, need to use the manual steps below.

#### If all Else Fails

1. Complete the installation steps for the backend as specified in the [backend repo](https://github.com/TangleML/tangle)
2. Co-locate your local `tangle-ui` repo inside your local `tangle` repo
3. Run `pnpm run build` inside `tangle-ui`
4. Start the backend using the provided instructions in the `tangle` repo

If you complete these steps the app will launch on `127.0.0.1:8000` with the latest build you've created on the frontend.

### AI provider configuration

AI features use the selected backend proxy by default. In Settings → AI Configuration, turn on bring your own key to use a provider directly. Explicitly saved choices are preserved. Direct Anthropic requests use `https://api.anthropic.com/v1`; OpenAI-compatible gateways keep the Responses protocol even when the selected model is Claude.

The model picker selects the first suggested model when no model is selected. Choose **Custom model…** in its model list to enter a model ID; models without declared thinking options show only the model. In Settings, custom model selections are saved after a successful connection test.

Backend proxy mode sends requests to these routes under the selected backend URL:

- `POST /api/experimental/ai/v1/responses`: OpenAI Responses-compatible requests and responses.
- `POST /api/experimental/ai/v1/embeddings`: OpenAI-compatible embeddings for semantic search.
- `POST /api/experimental/ai/anthropic/v1/messages`: native Anthropic Messages requests and responses for Claude models.

The frontend sends backend requests with browser credentials; the backend owns upstream provider authentication. Native Claude translation supports non-streaming requests with the full conversation history. Documentation search falls back to text ranking when embeddings are unavailable; native Anthropic component search skips embeddings and can rerank lexical candidates.

Model suggestions do not detect backend capabilities. Only select Claude in backend mode if that backend implements the native Messages route; otherwise those requests fail. Hosts can replace suggestions with `window.__TANGLE_AI_MODELS__.models`; the first valid entry is the default. Hosts must keep that catalog consistent with the backends they offer.

The catalog's Claude models support Low, Medium, High, Extra high, and Max in the thinking slider. Native requests send the selected level as `output_config.effort`; compatible gateways receive `reasoning.effort`. These models use adaptive thinking by default, so no manual thinking-token budget is needed. See [Claude's effort documentation](https://platform.claude.com/docs/en/build-with-claude/effort). Custom model IDs only show thinking controls when the host catalog declares supported effort levels.

### Environment Variables

Add these to a `.env` file at the root of `tangle-ui`.

Vite reads these values at development server startup or build time. Restart the
development server after changes, or rebuild the frontend for deployment.

| Variable                       | Required             | Description                                                                                                                                                                                                                                  |
| ------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_BACKEND_API_URL`         | For backend features | URL of your Tangle backend (e.g. `http://127.0.0.1:8000`).                                                                                                                                                                                   |
| `VITE_REMOTE_PIPELINES`        | No                   | Opt in to remote pipeline storage with `true` on a backend that supports saved pipelines. Unset or `false` keeps new pipelines, imports, and copies in browser storage. Without a configured backend, storage stays local even when enabled. |
| `VITE_LOCAL_PIPELINES`         | No                   | Legacy override: `true` keeps new pipelines local and hides the remote list, including when `VITE_REMOTE_PIPELINES=true`. Prefer leaving remote storage disabled for local-only deployments.                                                 |
| `VITE_ARTIFACT_RETENTION_DAYS` | No                   | Number of days artifacts are stored by your backend. When set, the UI shows artifact expiry dates and warns when artifacts may no longer be available.                                                                                       |
| `VITE_BUGSNAG_API_KEY`         | No                   | Bugsnag API key. Required alongside `VITE_TANGLE_ENV` to enable error reporting.                                                                                                                                                             |
| `VITE_TANGLE_ENV`              | No                   | Release stage passed to Bugsnag (e.g. `development`, `staging`, `production`).                                                                                                                                                               |

## App features:

- Build and edit pipelines using drag and drop visual editor
- Configure component arguments
- Submit the pipeline for execution. (Follow the [backend installation instructions](https://github.com/TangleML/tangle?tab=readme-ov-file#installation).)
- The ComponentSpec/`component.yaml` format used by Cloud Pipelines is fully compatible with the Google Cloud Vertex AI Pipelines and Kubeflow Pipelines v1. You can find many components here: [Ark-kun/pipeline_components](https://github.com/Ark-kun/pipeline_components/)
- Preloaded component library
- User component library (add private components)
- Remote component library
- GitHub-based libraries
- [Component discovery and search](docs/component-discovery.md)
- Import and export pipelines
- Create subgraphs and nested pipelines
- In-app component editor
- Disable cache
- Cancel executions
- Clone pipelines and review ongoing executions (logs, artifacts, run status)

Feel free to provide feedback, flag and issue or make a suggestion: [issues](https://github.com/TangleML/tangle-ui/issues).

## Credits:

This app is based on the [Pipeline Editor](https://cloud-pipelines.net/pipeline-editor) app created by [Alexey Volkov](https://github.com/Ark-kun) as part of the [Cloud Pipelines](https://github.com/Cloud-Pipelines) project.
