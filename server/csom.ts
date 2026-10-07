import type { ComponentSpecJson } from "../src/models/componentSpec/entities/types";
import { IncrementingIdGenerator } from "../src/models/componentSpec/factories/idGenerator";
import { serializeComponentSpec } from "../src/models/componentSpec/serialization/serialize";
import { YamlDeserializer } from "../src/models/componentSpec/serialization/yamlDeserializer";
import { applyCollabCommand } from "../src/services/collaboration/serializedAction";
import type { CollabSnapshot } from "../src/services/collaboration/protocol";
import {
  fromCollabSnapshot,
  toCollabSnapshot,
} from "../src/services/collaboration/snapshot";
import { sanitizeSpecForBackend } from "../src/utils/sanitizeSpecForBackend";
import type { RoomState } from "./roomStore";

/** Deserialize a plain backend document into the keystone room seed snapshot. */
export function specToCollabSnapshot(spec: ComponentSpecJson): CollabSnapshot {
  const root = new YamlDeserializer(new IncrementingIdGenerator()).deserialize(
    spec,
  );
  return toCollabSnapshot(root);
}

/**
 * Materialize the room's live document: rebuild the snapshot and replay its
 * command log through the real CSOM, so persistence sees the same state every
 * replica does. A command that throws is a no-op here, exactly as on a replica.
 */
export function roomStateToPlainSpec(room: RoomState): ComponentSpecJson {
  const root = fromCollabSnapshot(room.snapshot);
  for (const entry of room.log) {
    try {
      applyCollabCommand(root, entry.command);
    } catch {
      // A semantically impossible command is a no-op on every replica.
    }
  }
  return sanitizeSpecForBackend(serializeComponentSpec(root));
}
