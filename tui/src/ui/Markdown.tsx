import { Text } from "ink";
import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

const marked = new Marked();
marked.use(markedTerminal());

/** Renders a markdown string to ANSI-styled terminal text, trimming trailing newlines. */
export function renderMarkdown(markdown: string): string {
  if (!markdown.trim()) return "";
  try {
    const out = marked.parse(markdown, { async: false });
    return typeof out === "string" ? out.replace(/\s+$/, "") : markdown;
  } catch {
    return markdown;
  }
}

export function Markdown({ children }: { children: string }) {
  const rendered = renderMarkdown(children);
  if (!rendered) return null;
  return <Text>{rendered}</Text>;
}
