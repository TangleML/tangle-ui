import type {
  AnchorProtocolMap,
  AnchorProtocolProps,
} from "@tangent/embed-react";

import { ComponentChipFromContext } from "./ComponentChipFromContext";
import { EntityChip } from "./EntityChip";

function EntityAnchor({ path, label }: AnchorProtocolProps) {
  return <EntityChip entityId={path} label={label} />;
}

function ComponentAnchor({ path, label }: AnchorProtocolProps) {
  return <ComponentChipFromContext componentId={path} label={label} />;
}

/**
 * Host-owned anchor renderers for embedded `<Chat>`: markdown links using the
 * `entity://` and `component://` protocols render the same chips the legacy
 * editor chat uses (see `renderMarkdown`), projected into the host React tree.
 */
export const chatAnchorProtocols: AnchorProtocolMap = {
  entity: EntityAnchor,
  component: ComponentAnchor,
};
