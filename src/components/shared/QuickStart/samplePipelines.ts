export interface SamplePipeline {
  name: string;
  description: string;
  url: string;
  previewImage?: string;
  tags?: string[];
}

export const samplePipelines: SamplePipeline[] = [
  {
    name: "XGBoost Sample Pipeline",
    description:
      "Train and evaluate an XGBoost model with feature preprocessing and hyperparameter tuning. Demonstrates a complete ML workflow from data loading to model evaluation.",
    url: "example-pipelines/XGBoost pipeline.pipeline.component.yaml",
    previewImage: "example-pipelines/XGBoost pipeline.pipeline.component.png",
    tags: ["XGBoost", "Classification", "Tabular Data"],
  },
  /*
  {
    name: "PyTorch Network",
    description:
      "Build and train a fully-connected neural network using PyTorch. Includes data loading, model architecture definition, training loop, and evaluation metrics.",
    url: "example-pipelines/Pytorch pipeline.pipeline.component.yaml",
    previewImage: "example-pipelines/Pytorch pipeline.pipeline.component.png",
    tags: ["PyTorch", "Deep Learning", "Neural Network"],
  },
  {
    name: "Vertex AI AutoML Tables",
    description:
      "Leverage Google Cloud's Vertex AI AutoML to automatically build and deploy tabular models. No coding required for model training.",
    url: "example-pipelines/Vertex AI AutoML Tables pipeline.pipeline.component.yaml",
    previewImage:
      "example-pipelines/Vertex AI AutoML Tables pipeline.pipeline.component.png",
    tags: ["AutoML", "Google Cloud", "Vertex AI"],
  },
  {
    name: "TFX Pipeline",
    description:
      "Production-ready TensorFlow Extended (TFX) pipeline for end-to-end ML workflows. Includes data validation, transformation, training, and model serving.",
    url: "example-pipelines/Tfx pipeline.pipeline.component.yaml",
    previewImage: "example-pipelines/Tfx pipeline.pipeline.component.png",
    tags: ["TensorFlow", "TFX", "Production"],
  },
  */
];
