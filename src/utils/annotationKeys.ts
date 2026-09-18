/**
 * Annotation key names, deliberately kept in a module with no imports of its
 * own. `@/utils/annotations` re-exports all of these alongside its helpers, but
 * that module reaches into the components tree, which breaks vitest mock
 * hoisting for pure utils — so leaf utils and their tests import from here.
 */

export const TASK_DISPLAY_NAME_ANNOTATION = "display_name";
export const PIPELINE_NOTES_ANNOTATION = "notes";
export const PIPELINE_RUN_NOTES_ANNOTATION = "notes";
export const PIPELINE_TAGS_ANNOTATION = "tags";
export const PIPELINE_CANONICAL_NAME_ANNOTATION = "canonical-pipeline-name";
export const RUN_NAME_TEMPLATE_ANNOTATION = "run-name-template";
export const RUN_SOURCE_ANNOTATION = "source";
export const EDITOR_POSITION_ANNOTATION = "editor.position";
export const EDITOR_COLLAPSED_ANNOTATION = "editor.collapsed";
export const EDITOR_FLOW_DIRECTION_ANNOTATION = "editor.flow-direction";
export const FLEX_NODES_ANNOTATION = "flex-nodes";
export const ZINDEX_ANNOTATION = "zIndex";
export const SDK_ANNOTATION = "sdk";
export const TASK_COLOR_ANNOTATION = "tangleml.com/editor/task-color";
export const EDGE_CONDUITS_ANNOTATION = "tangleml.com/editor/edge-conduits";
export const PROJECT_ID_ANNOTATION_PREFIX = "tangleml.com/project/project-id/";
