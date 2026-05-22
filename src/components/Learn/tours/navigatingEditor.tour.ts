import type { TourDefinition, TourStep } from "./registry";

const steps: TourStep[] = [
  {
    selector: '[data-tour-anchor="no-spotlight"]',
    content:
      "Welcome to the pipeline editor! This quick tour will show you around so you know where to find everything: the menu bar, canvas, dockable panels, and floating windows.",
    position: "center",
  },
  {
    selector: '[data-tour="editor-top-bar"]',
    content:
      "The menu bar lives at the top. You'll find your pipeline name here, along with the application menus and your run and save controls.",
    position: "bottom",
  },
  {
    selector: '[data-tour="editor-menu-items"]',
    content:
      "These menus cover every editor command. File handles pipeline operations, View switches layout presets, Runs is for submissions, Components manages your libraries, Windows opens up panels, and Node has the task actions.",
    position: "bottom",
  },
  {
    selector: '[data-tour="editor-top-bar-actions"]',
    content:
      "Over on the right are your quick actions. Submit a run, check autosave status, switch between editor v1 and v2, jump to Settings, or open the documentation.",
    position: "bottom",
  },
  {
    selector: ".react-flow__pane",
    content:
      "This is your workspace. Drag components onto it, connect tasks by linking their input and output handles, and pan or zoom around larger graphs.",
    position: "center",
    resizeObservables: [".react-flow__pane"],
  },
  {
    selector: ".react-flow__controls",
    highlightedSelectors: [
      ".react-flow__controls",
      ".react-flow__minimap",
      '[data-tour="canvas-undo-redo"]',
    ],
    content:
      "The canvas tools sit around the edges. The minimap is in the bottom-left, and viewport controls are in the bottom-right with undo/redo right next to them.",
    position: "top",
    padding: { mask: 4, popover: 10 },
    resizeObservables: [".react-flow__pane"],
  },
  {
    selector: '[data-dock-window="component-library"]',
    highlightedSelectors: [
      '[data-dock-window="component-library"]',
      '[data-dock-window-content="component-library"]',
    ],
    content:
      "This is your component library, docked on the left. Search for what you need, browse by folder, and drag any component onto the canvas to add it as a task.",
    position: "right",
    resizeObservables: ['[data-dock-window-content="component-library"]'],
  },
  {
    selector: '[data-dock-window="runs-and-submission"]',
    highlightedSelectors: [
      '[data-dock-window="runs-and-submission"]',
      '[data-dock-window-content="runs-and-submission"]',
    ],
    content:
      "You can submit pipeline runs from here. Once your pipeline is valid the Submit button lights up, and your recent runs show up below for quick access.",
    position: "right",
    resizeObservables: ['[data-dock-window-content="runs-and-submission"]'],
  },
  {
    selector: '[data-dock-area="right"]',
    content:
      "The right sidebar holds Pipeline Details and its properties. Set the pipeline name, description, tags, and notes here, and review any validation warnings.",
    resizeObservables: ['[data-dock-area="right"]'],
  },
  {
    selector: '.react-flow__node[data-task-name="Greet"]',
    content: "Try clicking the Greet task on the canvas to select it.",
    position: "top",
    stepInteraction: true,
    interaction: "select-task",
  },
  {
    selector: '[data-window-id="context-panel"]',
    position: "left",
    highlightedSelectors: [
      '[data-window-id="context-panel"]',
      '[data-dock-window-content="context-panel"]',
    ],
    mutationObservables: [
      '[data-window-id="context-panel"]',
      '[data-dock-window-content="context-panel"]',
    ],
    resizeObservables: [
      '[data-window-id="context-panel"]',
      '[data-dock-window-content="context-panel"]',
    ],
    targetWindowId: "context-panel",
    content:
      "Selecting a task opens its Task Properties panel here in the right sidebar. From this panel you can edit input arguments, configure node settings, define annotations, and inspect the component spec.",
  },
  {
    selector: '[data-window-id="context-panel"]',
    content:
      "Windows are flexible. Try grabbing the Task Properties header and dragging it out of the dock to float it as its own window.",
    position: "left",
    stepInteraction: true,
    interaction: "undock-window",
    targetWindowId: "context-panel",
    fallbackContent:
      "Windows are flexible. Try grabbing the Task Properties header and dragging it around the canvas.",
  },
  {
    selector: '[data-window-id="context-panel"]',
    content:
      "Nice! Now drag that floating window back onto the left or right sidebar to re-dock it.",
    position: "left",
    stepInteraction: true,
    interaction: "redock-window",
    targetWindowId: "context-panel",
    fallbackContent:
      "Windows can be docked in either sidebar. Create the perfect layout that suits you!",
  },
  {
    selector: '[data-tracking-id="v2.pipeline_editor.windows_menu"]',
    highlightedSelectors: [
      '[data-tracking-id="v2.pipeline_editor.windows_menu"]',
      '[data-tour="windows-menu-content"]',
      '[data-tour="windows-menu-submenu-content"]',
    ],
    mutationObservables: [
      '[data-tour="windows-menu-content"]',
      '[data-tour="windows-menu-submenu-content"]',
    ],
    content:
      "Last one. If you ever need to reconfigure your layout, the Windows menu lets you toggle panels on or off and apply a layout preset.",
    position: "right",
    stepInteraction: true,
  },
];

export const navigatingEditorTour: TourDefinition = {
  id: "navigating-the-editor",
  displayName: "Guided Tour: Navigating the Editor",
  requiresEditor: true,
  starterPipelineUrl:
    "example-pipelines/Intro-Hello World.pipeline.component.yaml",
  steps,
};
