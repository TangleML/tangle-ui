import type {
  ComponentReference,
  ValidationIssue,
} from "@/models/componentSpec";
import type {
  InputSpecJson,
  OutputSpecJson,
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
  inputDiff: EntityDiff<InputSpecJson>;
  outputDiff: EntityDiff<OutputSpecJson>;
  lostBindings: LostBinding[];
  predictedIssues: ValidationIssue[];
}

export function candidateHasIssues(candidate: UpgradeCandidate): boolean {
  return candidate.predictedIssues.length > 0;
}
