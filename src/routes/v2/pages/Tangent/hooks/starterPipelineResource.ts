import {
  localPipelineInput,
  pointerOf,
} from "@/components/Project/localPipelinePointer";
import {
  localPipelineResourceExtraData,
  parseResourceExtraData,
} from "@/routes/v2/pages/Tangent/workarea/resourceExtraData";
import type { WorkareaTarget } from "@/routes/v2/pages/Tangent/workarea/types";
import {
  idIdentity,
  nameIdentity,
  parseWorkareaTarget,
} from "@/routes/v2/pages/Tangent/workarea/workareaTarget";
import type {
  CreateResourceInput,
  ProjectResourceSummary,
} from "@/services/projects/types";

const LOCAL_PIPELINE_TYPE = "local_pipeline";

interface CreatedPipeline {
  id: string;
  storageKey: string;
}

/**
 * The two surfaces that list a browser-held pipeline read a project's row
 * differently — Tangent's resources window wants `type` and `identity`, the
 * project page's `pointerOf` wants `localName` and `localId`. A row carrying
 * only one of them still appears in both lists, but the project page would
 * offer it for deletion saying it holds the only copy, which is untrue of a
 * pipeline that lives in the browser. So it is written for both readers.
 */
export function starterPipelineResourceInput(
  file: CreatedPipeline,
): CreateResourceInput {
  const pointer = localPipelineInput({
    localName: file.storageKey,
    localId: file.id,
  });

  return {
    ...pointer,
    extraData: {
      ...pointer.extraData,
      ...localPipelineResourceExtraData(file.id),
    },
  };
}

/** What to open for a row in either shape, so neither is added twice. */
export function browserPipelineTarget(
  resource: ProjectResourceSummary,
): WorkareaTarget | undefined {
  const extra = parseResourceExtraData(resource.extraData);
  if (extra?.type === LOCAL_PIPELINE_TYPE && extra.identity) {
    return parseWorkareaTarget(extra.identity);
  }

  const pointer = pointerOf(resource);
  if (!pointer) return undefined;

  return {
    type: "pipeline",
    identity: pointer.localId
      ? idIdentity(pointer.localId)
      : nameIdentity(pointer.localName),
  };
}
