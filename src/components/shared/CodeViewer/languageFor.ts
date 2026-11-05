const PLAIN_TEXT = "plaintext";

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  md: "markdown",
  markdown: "markdown",
  json: "json",
  ipynb: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  ini: "ini",
  cfg: "ini",
  py: "python",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ps1: "powershell",
  sql: "sql",
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  scala: "scala",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  r: "r",
  jl: "julia",
  lua: "lua",
  php: "php",
  swift: "swift",
  html: "html",
  css: "css",
  scss: "scss",
  xml: "xml",
  graphql: "graphql",
  proto: "protobuf",
  dockerfile: "dockerfile",
  tf: "hcl",
};

/**
 * A document is named by whoever wrote it, not by a file picker, so the
 * extension is a hint and often absent. Anything unrecognised reads as plain
 * text rather than being guessed at and mis-highlighted.
 */
export function languageFor(name: string | null | undefined): string {
  const extension = name?.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_BY_EXTENSION[extension] ?? PLAIN_TEXT;
}
