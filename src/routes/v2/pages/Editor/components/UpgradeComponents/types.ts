import type {
  ComponentReference,
  ValidationIssue,
} from "@/models/componentSpec";
import type {
  InputSpec,
  OutputSpec,
} from "@/models/componentSpec/entities/types";
import type { EntityDiff } from "@/routes/v2/pages/Editor/store/actions/task.utils";

export interface LostBinding {
  bindingId: string;
  sourceEntityId: string;
  sourcePortName: string;
  targetEntityId: string;
  targetPortName: string;
  reason: "lost_input" | "lost_output";
}

export interface UpgradeCandidate {
  taskId: string;
  taskName: string;
  currentDigest: string;
  newComponentRef: ComponentReference;
  inputDiff: EntityDiff<InputSpec>;
  outputDiff: EntityDiff<OutputSpec>;
  lostBindings: LostBinding[];
  predictedIssues: ValidationIssue[];
  /** Lineage origin id shared by all tasks descended from the same component. */
  originId?: string;
  /**
   * True when this task was locally edited so its digest fell outside the
   * published supersession chain, but its lineage still traces back to a
   * component family that has a catalog upgrade available.
   */
  isEditedOffMainline?: boolean;
}

export function candidateHasIssues(candidate: UpgradeCandidate): boolean {
  return candidate.predictedIssues.length > 0;
}
