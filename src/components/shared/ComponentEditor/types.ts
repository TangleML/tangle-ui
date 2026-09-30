export type SupportedTemplate =
  | "empty"
  | "ruby"
  | "python"
  | "javascript"
  | "bash";

export interface YamlGeneratorOptions {
  baseImage?: string;
  packagesToInstall?: string[];
  annotations?: Record<string, string>;
}

export type YamlGenerator = (
  text: string,
  options?: YamlGeneratorOptions,
) => Promise<string>;
