import { describe, expect, it } from "vitest";

import { languageFor } from "./languageFor";

describe("languageFor", () => {
  it.each([
    ["notes.md", "markdown"],
    ["scripts/train.py", "python"],
    ["run.sh", "shell"],
    ["App.tsx", "typescript"],
    ["Gemfile.rb", "ruby"],
    ["main.go", "go"],
    ["Dockerfile", "dockerfile"],
    ["Dockerfile.dev", "dockerfile"],
    ["deploy/Dockerfile.prod", "dockerfile"],
    ["Dockerfile.md", "markdown"],
    ["config.TOML", "ini"],
    ["notebook.ipynb", "json"],
  ])("maps %s to %s", (name, language) => {
    expect(languageFor(name)).toBe(language);
  });

  it("reads a name without a dot as plain text, not as an extension", () => {
    expect(languageFor("Go")).toBe("plaintext");
    expect(languageFor("R")).toBe("plaintext");
    expect(languageFor("Markdown")).toBe("plaintext");
  });

  it("reads anything it does not know as plain text", () => {
    expect(languageFor("Model card")).toBe("plaintext");
    expect(languageFor("archive.tar.gz")).toBe("plaintext");
    expect(languageFor(null)).toBe("plaintext");
    expect(languageFor(undefined)).toBe("plaintext");
  });
});
