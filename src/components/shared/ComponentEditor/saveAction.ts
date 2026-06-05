/**
 * What the user chose to do with an edited component definition on Save.
 *
 * - `update`  — apply the edit to the selected task in place
 * - `import`  — import the edited component into the library as a new component
 * - `place`   — create a new task from the edit, placed near the selected task
 * - `cancel`  — dismiss; keep the editor open
 */
export type SaveAction = "update" | "import" | "place" | "cancel";
