# Tangle app

Tangle is a web app that allows the users to build and run Machine Learning pipelines using drag and drop without having to set up development environment.

[![image](https://github.com/user-attachments/assets/0ce7ccc0-dad7-4f6a-8677-f2adcd83f558)](https://tangleml-tangle.hf.space/#/quick-start)

<!--
## Video

Please take a look at the short video demonstrating the first version of the visual pipeline editor.

[Cloud Pipelines Editor - Build machine learning pipelines without writing code](https://www.youtube.com/watch?v=7g22nupCDes)
-->

## Demo

[Demo]([https://cloud-pipelines.net/pipeline-studio-app](https://tangleml-tangle.hf.space/#/quick-start))

The experimental new version of the Tangle app is now available at <https://tangleml-tangle.hf.space/#/quick-start> . No registration is required to experiment with building pipelines. To install your own app instance, [duplicate](https://huggingface.co/spaces/TangleML/tangle?duplicate=true) the HuggingFace space or follow the [backend installation instructions](https://github.com/Cloud-Pipelines/backend?tab=readme-ov-file#installation).

Please check it out and report any bugs you find using [GitHub Issues](https://github.com/TangleML/tangle/issues).

The app is under active development, so expect some breakages as I work on the app and do not rely on the app for production.

### App features:

- Build pipeline using drag and drop
- Edit component arguments
- Submit the pipeline for execution. (Follow the [backend installation instructions](https://github.com/Cloud-Pipelines/backend?tab=readme-ov-file#installation).)
- The ComponentSpec/`component.yaml` format used by Cloud Pipelines is fully compatible with the Google Cloud Vertex AI Pipelines and Kubeflow Pipelines v1. You can find many components here: [Ark-kun/pipeline_components](https://github.com/Ark-kun/pipeline_components/)
- Preloaded component library
- User component library (add private components)
- Component search
- Import and export pipelines

There are many features that I want to add, but I want to prioritize them based on your feedback.

### Credits:

This app is based on the [Pipeline Editor](https://cloud-pipelines.net/pipeline-editor) app created by [Alexey Volkov](https://github.com/Ark-kun) as part of the [Cloud Pipelines](https://github.com/Cloud-Pipelines) project.
