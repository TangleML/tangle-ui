# Tangle app (Frontend)

Tangle is a web app that allows the users to build and run Machine Learning pipelines using drag and drop without having to set up development environment.

[![image](https://github.com/user-attachments/assets/0ce7ccc0-dad7-4f6a-8677-f2adcd83f558)](https://tangleml-tangle.hf.space/#/quick-start)

This is the frontend repo. It contains the entire user interface portion of the app. It is built primarily on Typescript + React + Tailwind CSS, and powered by NodeJS + Vite.

> Go to the [backend repo](https://github.com/TangleML/tangle).

## Demo

[Demo](<[https://cloud-pipelines.net/pipeline-studio-app](https://tangleml-tangle.hf.space/#/quick-start)>)

The experimental new version of the Tangle app is now available at <https://tangleml-tangle.hf.space/#/quick-start> . No registration is required to experiment with building pipelines. To install your own app instance, [duplicate](https://huggingface.co/spaces/TangleML/tangle?duplicate=true) the HuggingFace space or follow the [backend installation instructions](https://github.com/Cloud-Pipelines/backend?tab=readme-ov-file#installation).

Please check it out and report any bugs you find using [GitHub Issues](https://github.com/TangleML/tangle/issues).

The app is under active development and supported by Shopify Engineers.

## Installation

**tangle-ui** can be operated and developed independently of the backend.

### Standalone Web App - Instructions

1. Install [Node Package Manager](https://www.npmjs.com/) (`npm`) & `node`
2. Fork the `tangle-ui` repo - we recommend colocating the repo with the backend
3. Navigate to the forked repo and install dependencies with `npm i`
4. You are now ready to go! Run the app with `npm run start` 🚀

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
3. Run `npm run build` inside `tangle-ui`
4. Start the backend using the provided instructions in the `tangle` repo

If you complete these steps the app will launch on `127.0.0.1:8000` with the latest build you've created on the frontend.

## App features:

- Build and edit pipelines using drag and drop visual editor
- Configure component arguments
- Submit the pipeline for execution. (Follow the [backend installation instructions](https://github.com/TangleML/tangle?tab=readme-ov-file#installation).)
- The ComponentSpec/`component.yaml` format used by Cloud Pipelines is fully compatible with the Google Cloud Vertex AI Pipelines and Kubeflow Pipelines v1. You can find many components here: [Ark-kun/pipeline_components](https://github.com/Ark-kun/pipeline_components/)
- Preloaded component library
- User component library (add private components)
- Remote component library
- GitHub-based libraries
- Component search
- Import and export pipelines
- Create subgraphs and nested pipelines
- In-app component editor
- Disable cache
- Cancel executions
- Clone pipelines and review ongoing executions (logs, artifacts, run status)

Feel free to provide feedback, flag and issue or make a suggestion: [issues](https://github.com/TangleML/tangle-ui/issues).

## Credits:

This app is based on the [Pipeline Editor](https://cloud-pipelines.net/pipeline-editor) app created by [Alexey Volkov](https://github.com/Ark-kun) as part of the [Cloud Pipelines](https://github.com/Cloud-Pipelines) project.
