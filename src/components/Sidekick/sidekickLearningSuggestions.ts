import { APP_ROUTES } from "@/routes/appRoutes";

export type LearningSuggestion =
  | { type: "tour"; tourId: string; label: string }
  | { type: "route"; to: string; label: string; hash?: string };

export function getLearningSuggestion(question: string): LearningSuggestion {
  const normalized = question.toLowerCase();

  if (normalized.includes("secret") || normalized.includes("credential")) {
    return {
      type: "tour",
      tourId: "using-secrets",
      label: "Use secrets safely",
    };
  }

  if (normalized.includes("subgraph") || normalized.includes("nested")) {
    return {
      type: "tour",
      tourId: "subgraphs",
      label: "Group tasks into subgraphs",
    };
  }

  if (normalized.includes("component")) {
    return {
      type: "route",
      to: APP_ROUTES.LEARN_TIPS,
      hash: "library",
      label: "Create and manage components",
    };
  }

  if (
    normalized.includes("run") ||
    normalized.includes("execution") ||
    normalized.includes("log") ||
    normalized.includes("debug") ||
    normalized.includes("artifact") ||
    normalized.includes("fail")
  ) {
    return {
      type: "route",
      to: APP_ROUTES.LEARN_TIPS,
      hash: "runs",
      label: "Explore run tips",
    };
  }

  if (
    normalized.includes("first") ||
    normalized.includes("create") ||
    normalized.includes("pipeline")
  ) {
    return {
      type: "tour",
      tourId: "first-pipeline",
      label: "Build your first pipeline",
    };
  }

  if (normalized.includes("example")) {
    return {
      type: "route",
      to: APP_ROUTES.LEARN_EXAMPLES,
      label: "Browse example pipelines",
    };
  }

  if (
    normalized.includes("editor") ||
    normalized.includes("window") ||
    normalized.includes("navigate") ||
    normalized.includes("canvas") ||
    normalized.includes("shortcut")
  ) {
    return {
      type: "tour",
      tourId: "navigating-the-editor",
      label: "Find your way around the editor",
    };
  }

  return {
    type: "route",
    to: APP_ROUTES.LEARN_TOURS,
    label: "Browse guided tours",
  };
}
