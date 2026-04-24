import type { editor } from "monaco-editor";

export const HOURS = 1000 * 60 * 60;

export const DEFAULT_MONACO_OPTIONS: editor.IStandaloneEditorConstructionOptions =
  {
    minimap: {
      enabled: false,
    },
    scrollBeyondLastLine: false,
    lineNumbers: "on",
    wordWrap: "on",
    automaticLayout: true,
  };

export function handleEditorMount(ed: editor.IStandaloneCodeEditor): void {
  ed.onKeyDown((e) => {
    if (e.browserEvent.key === " ") {
      e.browserEvent.stopPropagation();
    }
  });
}
